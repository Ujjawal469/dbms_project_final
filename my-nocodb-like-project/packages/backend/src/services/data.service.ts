import { prisma } from '../config/db';
import { Prisma } from '@prisma/client';
import * as metaService from './meta.service'; // Used for schema validation
import csvParser from 'csv-parser';
import stream from 'stream';

// Assuming FilterCondition is defined here or imported
interface FilterCondition {
    column?: string;
    operator?: string;
    value?: any;
    logicalOperator?: 'AND' | 'OR';
}

interface PaginationOptions {
    limit: number;
    offset: number;
}

// Extend options to include filters
interface GetDataOptions extends PaginationOptions {
    filters?: FilterCondition[];
    // Add sort_by, sort_order etc. here later if needed
}


//-------------- get table data (ENHANCED FOR FILTERING) -----------------------
export const getData = async (
    tableName: string,
    options: GetDataOptions // Use extended options type
): Promise<{ data: any[]; total: number }> => {
    console.log(`Fetching data for table: ${tableName} with options:`, options);

    // Initial Table Name Validation (keep this)
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
        throw new Error(`Invalid table name format: ${tableName}`);
    }
    // Use Prisma's recommended way or manually quote if necessary - Prisma might handle table names in $queryRawUnsafe context
    // For safety with raw SQL, quoting is generally good practice if not using tagged templates
    const safeTableName = `"${tableName}"`; // Simple quoting, adjust if needed for your DB

    // --- Filter Processing ---
    const whereConditions: string[] = [];
    const queryParams: any[] = [];
    let paramIndex = 1; // Start parameter index for $1, $2...

    // Get schema to validate filter columns
    const currentSchema = await metaService.getTableSchema(tableName);
    if (!currentSchema || currentSchema.length === 0) {
         throw new Error(`Could not retrieve schema for table "${tableName}" to validate filters.`);
    }
    const validColumnNames = new Set(currentSchema.map(col => col.name));


    if (options.filters && options.filters.length > 0) {
        options.filters.forEach((filter, index) => {
            // Validate column name exists in the schema
            if (!filter.column || !validColumnNames.has(filter.column)) {
                console.warn(`Skipping filter due to invalid or missing column: ${filter.column}`);
                return; // Skip this filter condition
            }
            if (!filter.operator) {
                 console.warn(`Skipping filter due to missing operator for column: ${filter.column}`);
                 return; // Skip this filter condition
            }

            // ** IMPORTANT: Safely quote the column name **
            const safeColumn = `"${filter.column}"`;
            let conditionStr = '';

            // Build condition based on operator
            switch (filter.operator.toUpperCase()) {
                case '=':
                case '!=':
                case '>':
                case '>=':
                case '<':
                case '<=':
                    queryParams.push(filter.value);
                    conditionStr = `${safeColumn} ${filter.operator} $${paramIndex++}`;
                    break;
                case 'LIKE':
                case 'NOT LIKE':
                    // Add wildcards for LIKE operations and push value
                    queryParams.push(`%${filter.value}%`);
                    conditionStr = `${safeColumn} ${filter.operator.toUpperCase()} $${paramIndex++}`;
                    break;
                case 'IS NULL':
                case 'IS NOT NULL':
                    // These operators don't take a value parameter
                    conditionStr = `${safeColumn} ${filter.operator.toUpperCase()}`;
                    break;
                // Add more operators here if needed (e.g., IN, BETWEEN)
                default:
                    console.warn(`Skipping filter due to unsupported operator: ${filter.operator}`);
                    return; // Skip unsupported operators
            }

            // Prepend logical operator (AND/OR) if it's not the first condition
            const logicalOp = index > 0 ? ` ${filter.logicalOperator?.toUpperCase() || 'AND'} ` : '';
            whereConditions.push(`${logicalOp}${conditionStr}`);
        });
    }

    // Construct the final WHERE clause string
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join('')}` : '';
    console.log("Constructed WHERE clause:", whereClause);
    console.log("Query parameters for WHERE:", queryParams);

    // --- Database Queries ---
    try {
        // --- Total Count Query ---
        // Use the generated WHERE clause and its specific parameters
        const countSql = `SELECT COUNT(*) FROM ${safeTableName} ${whereClause}`;
        console.log("Executing Count SQL:", countSql);
        const countResult = await prisma.$queryRawUnsafe<{ count: bigint }[]>(countSql, ...queryParams);
        const total = Number(countResult[0]?.count ?? 0);
        console.log("Total rows matching filter:", total);


        // --- Data Fetch Query ---
        // Add pagination parameters AFTER the where clause parameters
        const dataQueryParams = [...queryParams]; // Copy params used for WHERE
        dataQueryParams.push(options.limit);    // Add LIMIT param ($N)
        dataQueryParams.push(options.offset);   // Add OFFSET param ($N+1)

        // Re-calculate placeholders for LIMIT and OFFSET based on current paramIndex
        const limitPlaceholder = `$${paramIndex++}`;
        const offsetPlaceholder = `$${paramIndex++}`;

        // Get column list from validated schema
        const columnList = currentSchema.map(col => `"${col.name}"`).join(', ');
        // ** Important: Add ORDER BY **. Order by PK or a default column for consistent pagination.
        // Assuming 'serial_num' might not always be the PK or exist. Let's use the first column or PK.
        const primaryKey = await getPrimaryKeyColumn(tableName);
        const orderByColumn = primaryKey ? `"${primaryKey}"` : (currentSchema[0] ? `"${currentSchema[0].name}"` : '1'); // Fallback needed

        const dataSql = `SELECT ${columnList} FROM ${safeTableName} ${whereClause} ORDER BY ${orderByColumn} LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`;
        console.log("Executing Data SQL:", dataSql);
        console.log("Query parameters for Data:", dataQueryParams);

        const data = await prisma.$queryRawUnsafe<any[]>(dataSql, ...dataQueryParams);
        console.log(`Fetched ${data.length} rows for page.`);

        return { data, total };

    } catch (error: any) {
        console.error(`Error fetching data for table ${tableName}:`, error);
        // Keep existing specific error handling
        if (error.code === '42P01' || error.message?.includes("doesn't exist")) {
            throw new Error(`Table "${tableName}" not found.`);
        }
        // Add specific handling for syntax errors potentially caused by filter generation
        if (error.code === '42601') { // PostgreSQL syntax error code
             console.error("SQL Syntax Error Details:", error);
             throw new Error(`Error processing filters for table "${tableName}": SQL Syntax Error. Check filter operators and values.`);
        }
        // Generic fallback
        throw new Error(`Could not fetch data for table "${tableName}". DB Error: ${error.message}`);
    }
};


//------------------- Primary Key Column ----------------------------
// (getPrimaryKeyColumn remains the same)
export const getPrimaryKeyColumn = async (tableName: string): Promise<string | null> => {
  if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
    throw new Error(`Invalid table name format: ${tableName}`);
  }
  try {
    const result = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT kcu.column_name
      FROM information_schema.key_column_usage AS kcu
      JOIN information_schema.table_constraints AS tc ON kcu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_name = ${tableName} AND tc.table_schema = 'public'
      LIMIT 1;
    `;
    return result[0]?.column_name || null;
  } catch (error) {
    console.error(`Error finding primary key for table ${tableName}:`, error);
    return null; // Return null on error
  }
};

//--------------------- new row ------------------------------
// (createRow remains the same)
export const createRow = async (
  tableName: string,
  rowData: Record<string, any>
): Promise<any> => {
  console.log(`Creating row in table: ${tableName}`, rowData);

  if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
    console.error(`Invalid table name format attempted: ${tableName}`);
    throw new Error(`Invalid table name format: ${tableName}`);
  }

  const columnsToInsert: string[] = [];
  const valuesToInsert: any[] = [];

  // Filter out undefined values - useful if frontend sends optional fields as undefined
  for (const key in rowData) {
    if (Object.prototype.hasOwnProperty.call(rowData, key) && rowData[key] !== undefined) {
      columnsToInsert.push(key);
      valuesToInsert.push(rowData[key]);
    }
  }

  if (columnsToInsert.length === 0) {
    throw new Error('No valid data provided for insertion.');
  }

  // ** IMPORTANT: Safely quote column names **
  const columnList = columnsToInsert.map((col) => `"${col}"`).join(', ');
  const placeholders = columnsToInsert.map((_, i) => `$${i + 1}`).join(', ');
  // ** IMPORTANT: Safely quote table name **
  const insertSql = `INSERT INTO "${tableName}" (${columnList}) VALUES (${placeholders}) RETURNING *`;

  console.log(`Executing SQL: ${insertSql} with values:`, valuesToInsert);
  try {
    const result = await prisma.$queryRawUnsafe<any[]>(
      insertSql,
      ...valuesToInsert
    );

    if (!result || result.length === 0) {
      throw new Error(`Failed to insert row or retrieve inserted data from table "${tableName}".`);
    }

    console.log(`Row created successfully in ${tableName}:`, result[0]);
    return result[0]; // Return the first (and likely only) row returned

  } catch (error: any) {
    console.error(`Error creating row in table ${tableName}:`, error);
    // Keep existing specific error handling
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') { // Unique constraint violation (Prisma code)
           // Extract constraint name if available (useful for debugging)
           const constraint = error.meta?.target || error.meta?.constraint_name || 'unique';
           throw new Error(`Unique constraint (${constraint}) violation in table "${tableName}". DB Error: ${error.message}`);
        }
        if (error.code === 'P2003') { // Foreign key constraint
           const fieldName = error.meta?.field_name || 'foreign key';
           throw new Error(`Foreign key constraint violation on field '${fieldName}' in table "${tableName}". Referenced row does not exist. DB Error: ${error.message}`);
        }
         if (error.code === 'P2011') { // Not null constraint (Prisma 3+)
           const constraint = error.meta?.constraint || 'not null';
           throw new Error(`Not-null constraint (${constraint}) violation in table "${tableName}". DB Error: ${error.message}`);
        }
         if (error.meta?.code === '23502') { // Not null constraint (Postgres code)
           throw new Error(`Not-null constraint violation in table "${tableName}". A required column is missing or null. DB Error: ${error.message}`);
         }
         if (error.code === 'P2025') { // Record to update/delete not found - less likely for INSERT
           throw new Error(`Related record not found for operation in table "${tableName}". DB Error: ${error.message}`);
         }
         if (error.code === 'P2010') { // Raw query failed
              throw new Error(`Table "${tableName}" not found (Raw query failed). DB Error: ${error.message}`);
         }
      }
     if (error.code === '42P01') { // Table doesn't exist (Postgres code)
        throw new Error(`Table "${tableName}" not found. (DB Code: 42P01)`);
     }
     if (error.code === '42703') { // Column doesn't exist (Postgres code)
         throw new Error(`Column referenced in insert/update does not exist in table "${tableName}". (DB Code: 42703)`);
     }
     // Generic fallback
    throw new Error(`Could not insert data into table "${tableName}". Original error: ${error.message || error}`);
  }
};


//-------------------- Update Row --------------------------
// (updateRow remains mostly the same, ensure quoting and type handling)
export const updateRow = async (
  tableName: string,
  pkValue: any,      // Keep as any for flexibility, handle type below
  pkColumn: string,
  rowData: Record<string, any>
): Promise<any> => {
  console.log(`Updating row in table: ${tableName} where ${pkColumn}=${pkValue}`, rowData);

  if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
    throw new Error(`Invalid table name format: ${tableName}`);
  }
  if (!/^[a-zA-Z0-9_]+$/.test(pkColumn)) {
     throw new Error(`Invalid primary key column name format: ${pkColumn}`);
   }

  const columnsToUpdate: string[] = [];
  const valuesToUpdate: any[] = [];

  // Filter out undefined values
  for (const key in rowData) {
     if (Object.prototype.hasOwnProperty.call(rowData, key) && rowData[key] !== undefined) {
        columnsToUpdate.push(key);
        valuesToUpdate.push(rowData[key]);
     }
  }

  if (columnsToUpdate.length === 0) {
    // Consider if this should be an error or just return "no changes"
    // Returning the existing row might be better than throwing an error if no fields changed.
    console.log("No fields provided to update.");
    // Optionally, fetch and return the current row data here.
    // For now, let's throw, assuming an update implies changes.
    throw new Error('No data provided to update.');
  }

  // ** IMPORTANT: Safely quote column names **
  const setClause = columnsToUpdate.map((col, i) => `"${col}" = $${i + 1}`).join(', ');
  // ** IMPORTANT: Safely quote table and PK column name **
  const safeTableName = `"${tableName}"`;
  const safePkColumn = `"${pkColumn}"`;
  const updateSql = `UPDATE ${safeTableName} SET ${setClause} WHERE ${safePkColumn} = $${columnsToUpdate.length + 1} RETURNING *`;

  // ** Type Handling for PK value **
  // Attempt to convert to BigInt if it looks like a number, otherwise use as string
  // This might need adjustment based on your actual PK types (UUIDs etc.)
  let finalPkValue = pkValue;
  if (typeof pkValue === 'number' || (typeof pkValue === 'string' && /^\d+$/.test(pkValue))) {
      try {
          finalPkValue = BigInt(pkValue);
      } catch (e) {
          console.warn(`Could not convert PK value "${pkValue}" to BigInt, using original value.`);
          finalPkValue = pkValue; // Fallback to original value
      }
  }

  console.log(`Executing SQL: ${updateSql} with values:`, [...valuesToUpdate, finalPkValue]);

  try {
    const result = await prisma.$queryRawUnsafe<any[]>(updateSql, ...valuesToUpdate, finalPkValue);

    if (!result || result.length === 0) {
        // Changed error message for clarity
        throw new Error(`Record with ${pkColumn} = ${pkValue} not found in table "${tableName}" or no changes made.`);
    }
    console.log(`Row updated successfully in ${tableName}:`, result[0]);
    return result[0];

  } catch (error: any) {
      console.error(`Error updating row in table ${tableName}:`, error);
       // Add specific error handling similar to createRow (Unique constraints, FK constraints, etc.)
       if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            throw new Error(`Record with ${pkColumn} = ${pkValue} not found in table "${tableName}".`);
       }
       if (error.code === '42P01') { throw new Error(`Table "${tableName}" not found.`); }
       if (error.code === '42703') { throw new Error(`Column referenced in update does not exist in table "${tableName}".`); }
       // Add more specific checks if needed
      throw new Error(`Could not update record in table "${tableName}". Original error: ${error.message || error}`);
  }
};

//---------------------- Delete Row -------------------------------
// (deleteRow remains mostly the same, ensure quoting and type handling)
export const deleteRow = async (
  tableName: string,
  pkValue: any,      // Keep as any for flexibility
  pkColumn: string
): Promise<{ deleted: boolean }> => {
  console.log(`Deleting row from table: ${tableName} where ${pkColumn}=${pkValue}`);

  if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
    throw new Error(`Invalid table name format: ${tableName}`);
  }
   if (!/^[a-zA-Z0-9_]+$/.test(pkColumn)) {
     throw new Error(`Invalid primary key column name format: ${pkColumn}`);
   }

  // ** IMPORTANT: Safely quote table and PK column name **
  const safeTableName = `"${tableName}"`;
  const safePkColumn = `"${pkColumn}"`;
  const deleteSql = `DELETE FROM ${safeTableName} WHERE ${safePkColumn} = $1`;

  // ** Type Handling for PK value (similar to update) **
   let finalPkValue = pkValue;
   if (typeof pkValue === 'number' || (typeof pkValue === 'string' && /^\d+$/.test(pkValue))) {
       try {
           finalPkValue = BigInt(pkValue);
       } catch (e) {
            console.warn(`Could not convert PK value "${pkValue}" to BigInt, using original value.`);
            finalPkValue = pkValue; // Fallback
       }
   }

  console.log(`Executing SQL: ${deleteSql} with value:`, [finalPkValue]);

  try {
    // $executeRawUnsafe returns the number of affected rows
    const affectedRows = await prisma.$executeRawUnsafe(deleteSql, finalPkValue);
    console.log(`Delete operation affected ${affectedRows} row(s).`);
    // Return true if one or more rows were deleted
    return { deleted: affectedRows > 0 };

  } catch (error: any) {
       console.error(`Error deleting row from table ${tableName}:`, error);
        // Add specific error handling
       if (error.code === '42P01') { throw new Error(`Table "${tableName}" not found.`); }
       // Foreign Key constraint violation on DELETE (if other tables reference this row)
       if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
           throw new Error(`Cannot delete row from "${tableName}" because it is referenced by other records (foreign key constraint).`);
       }
       if (error.meta?.code === '23503') { // Postgres FK error code
           throw new Error(`Cannot delete row from "${tableName}" because it is referenced by other records (foreign key constraint). DB Error: ${error.message}`);
       }
       throw new Error(`Could not delete record from table "${tableName}". Original error: ${error.message || error}`);
  }
};

//--------------------------------------- Process CSV Upload ----------------------------------
export const processCsvUpload = async (
  tableName: string,
  fileBuffer: Buffer
): Promise<{ message: string; rowsProcessed: number; tableCreated: boolean }> => {
  console.log(`Processing CSV upload for table: ${tableName}`);

  if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
      throw new Error(`Invalid table name format: ${tableName}`);
  }
  const safeTableName = `"${tableName}"`;

  const csvData: any[] = [];
  let csvHeaders: string[] = [];
  let sanitizedHeaders: string[] = [];

  // --- 1. Parse CSV from Buffer ---
  try {
      await new Promise((resolve, reject) => {
          const bufferStream = new stream.PassThrough();
          bufferStream.end(fileBuffer);

          bufferStream
              .pipe(csvParser())
              .on('headers', (headers: string[]) => {
                  console.log('CSV Headers Raw:', headers);
                  if (!headers || headers.length === 0 || headers.some(h => !h || h.trim() === '')) {
                      return reject(new Error("CSV headers are invalid or empty."));
                  }
                  csvHeaders = headers;
                  sanitizedHeaders = headers.map(h =>
                      h.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
                  );
                   sanitizedHeaders = sanitizedHeaders.map(h => /^[a-z_]/.test(h) ? h : `_${h}`);
                  const headerSet = new Set(sanitizedHeaders);
                  if (headerSet.size !== sanitizedHeaders.length) {
                      return reject(new Error("CSV contains duplicate header names after sanitization."));
                  }
                  console.log('CSV Headers Sanitized:', sanitizedHeaders);
              })
              .on('data', (data) => {
                  const row: Record<string, any> = {};
                  sanitizedHeaders.forEach((sHeader, index) => {
                      const originalHeader = csvHeaders[index];
                      row[sHeader] = data[originalHeader] ?? null;
                  });
                  csvData.push(row);
              })
              .on('end', () => {
                  if (sanitizedHeaders.length === 0) {
                       return reject(new Error("No valid headers found in CSV file."));
                  }
                  console.log(`CSV Parsed successfully: ${csvData.length} data rows.`);
                  resolve(true);
              })
              .on('error', (error) => {
                  console.error("CSV Parsing Error:", error);
                  reject(new Error(`Failed to parse CSV file: ${error.message}`));
              });
      });
  } catch (parseError: any) {
      // Catch errors specifically from the parsing promise
      throw parseError;
  }

  // --- 2. Database Operations (within a transaction) ---
  let tableCreated = false;
  try {
      await prisma.$executeRawUnsafe(`BEGIN`);

      // Check if table exists
      const checkTableQuery = `
          SELECT EXISTS (
              SELECT FROM information_schema.tables
              WHERE table_schema = 'public' AND table_name = $1
          );`;
      const tableExistsResult = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(checkTableQuery, tableName);
      const tableExists = tableExistsResult[0]?.exists ?? false;

      if (tableExists) {
          console.log(`Table '${tableName}' exists. Replacing data.`);
          tableCreated = false;

           // ** Optional: Schema Validation **
           const existingSchema = await metaService.getTableSchema(tableName);
           const existingCols = new Set(existingSchema.map(c => c.name.toLowerCase()));
           const missingInDb = sanitizedHeaders.filter(h => !existingCols.has(h));
           if (missingInDb.length > 0) {
               await prisma.$executeRawUnsafe(`ROLLBACK`);
               throw new Error(`Schema mismatch: CSV header(s) '${missingInDb.join(', ')}' not found in existing table '${tableName}'.`);
           }
          console.log(`Deleting existing data from ${safeTableName}...`);
          await prisma.$executeRawUnsafe(`DELETE FROM ${safeTableName}`);

      } else {
          console.log(`Table '${tableName}' does not exist. Creating table.`);
          tableCreated = true;

          // ** IMPORTANT: Sanitize/Quote column names **
          const createColumns = sanitizedHeaders.map(h => `"${h}" TEXT`).join(', ');
          const createTableQuery = `CREATE TABLE ${safeTableName} (${createColumns})`;
          console.log("Executing Create Table:", createTableQuery);
          await prisma.$executeRawUnsafe(createTableQuery);
      }
      if (csvData.length > 0) {
          console.log(`Inserting ${csvData.length} new rows into ${safeTableName}...`);
          // ** IMPORTANT: Sanitize/Quote column names **
          const columnList = sanitizedHeaders.map(h => `"${h}"`).join(', ');
          const valuePlaceholders: string[] = [];
          const allValues: any[] = [];
          let paramCounter = 1;

          csvData.forEach(row => {
              const rowPlaceholders: string[] = [];
              sanitizedHeaders.forEach(header => {
                  rowPlaceholders.push(`$${paramCounter++}`);
                  allValues.push(row[header] ?? null); // Ensure value exists, default to null
              });
              valuePlaceholders.push(`(${rowPlaceholders.join(', ')})`);
          });

          if (valuePlaceholders.length > 0) {
              const insertSql = `INSERT INTO ${safeTableName} (${columnList}) VALUES ${valuePlaceholders.join(', ')}`;
               console.log(`Executing Insert SQL with ${allValues.length} parameters.`);
              await prisma.$executeRawUnsafe(insertSql, ...allValues);
          }
      }

      await prisma.$executeRawUnsafe(`COMMIT`); // Commit transaction

      const message = tableCreated
          ? `Successfully created table '${tableName}' and imported ${csvData.length} rows.`
          : `Successfully replaced data in table '${tableName}' with ${csvData.length} rows.`;

      return { message, rowsProcessed: csvData.length, tableCreated };

  } catch (dbError: any) {
      console.error(`Database operation failed during CSV processing for ${tableName}:`, dbError);
      try {
          await prisma.$executeRawUnsafe(`ROLLBACK`);
          console.log("Transaction rolled back.");
      } catch (rollbackError) {
          console.error("Failed to rollback transaction:", rollbackError);
      }
      if (dbError.code === '42P07') { // Table already exists (Postgres code) - should be handled by check, but good fallback
           throw new Error(`Table "${tableName}" already exists (concurrent creation?).`);
      }
       if (dbError.code === '42701') { // Duplicate column (Postgres code) - indicates issue with sanitized headers
           throw new Error(`Duplicate column name detected during table creation for "${tableName}". Check sanitized CSV headers.`);
       }
      throw new Error(`Database operation failed: ${dbError.message}`);
  }
};
import { prisma } from '../config/db';
import { Prisma } from '@prisma/client';
import * as metaService from './meta.service';
interface PaginationOptions {
  limit: number;
  offset: number;
}

// ✅ GET paginated data from table
export const getData = async (
  tableName: string,
  options: PaginationOptions
): Promise<{ data: any[]; total: number }> => {
  console.log(`Fetching data for table: ${tableName} with options:`, options);

  if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
    throw new Error(`Invalid table name format: ${tableName}`);
  }

  const safeTableName = `"${tableName}"`;

  try {
    const countSql = `SELECT COUNT(*) FROM ${safeTableName}`;
    const countResult = await prisma.$queryRawUnsafe<{ count: bigint }[]>(countSql);
    const total = Number(countResult[0]?.count ?? 0);
    const currentSchema = await metaService.getTableSchema(tableName); // Fetch schema
    if (!currentSchema || currentSchema.length === 0) {
         throw new Error(`Could not retrieve schema for table "${tableName}" after potential modification.`);
    }
    // Dynamically build column list, ensuring quoting
    const columnList = currentSchema.filter(col => col.name !== "serial_num").map(col => `"${col.name}"`).join(', ');

    // Use the explicit column list instead of '*'
    const dataSql = `SELECT ${columnList} FROM ${safeTableName} ORDER BY "serial_num" LIMIT $1 OFFSET $2`;

    const data = await prisma.$queryRawUnsafe<any[]>(dataSql, options.limit, options.offset);
    return { data, total };
  } catch (error: any) {
    console.error(`Error fetching data for table ${tableName}:`, error);
    if (error.code === '42P01' || error.message?.includes("doesn't exist")) {
      throw new Error(`Table "${tableName}" not found.`);
    }
    throw new Error(`Could not fetch data for table "${tableName}".`);
  }
};

// ✅ GET primary key column name
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
    return null;
  }
};

// ✅ CREATE row
export const createRow = async (
  tableName: string,
  rowData: Record<string, any>
): Promise<any> => {
  console.log(`Creating row in table: ${tableName}`, rowData);

  if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
    throw new Error(`Invalid table name format: ${tableName}`);
  }

  const columnsToInsert: string[] = [];
  const valuesToInsert: any[] = [];

  for (const key in rowData) {
    // Check if the key is not 'serial_num' and it's a direct property
    if (key !== 'serial_num' && Object.prototype.hasOwnProperty.call(rowData, key)) {
      columnsToInsert.push(key);
      valuesToInsert.push(rowData[key]);
    }
  }

  // 3. Check if there's any actual data left to insert
  if (columnsToInsert.length === 0) {
    // If only 'serial_num' was provided (or empty object), throw error.
    // Alternatively, you could allow inserting a row with only default values
    // by changing the SQL construction below, but throwing error is safer usually.
    throw new Error('No data provided for insertion (excluding serial_num).');
  }

  // 4. Construct SQL parts safely
  // Quote column names
  const columnList = columnsToInsert.map((col) => `"${col}"`).join(', ');
  // Create placeholders starting from $1
  const placeholders = columnsToInsert.map((_, i) => `$${i + 1}`).join(', ');

  // 5. Construct the final SQL query with RETURNING *
  // RETURNING * will give back the entire inserted row, including the auto-generated serial_num
  const insertSql = `INSERT INTO "${tableName}" (${columnList}) VALUES (${placeholders}) RETURNING *`;

  console.log(`Executing SQL: ${insertSql} with values:`, valuesToInsert);

  try {
    // 6. Execute the query using the filtered values
    // $queryRawUnsafe is needed because tableName is dynamic.
    // Parameters ($1, $2...) are handled safely by Prisma/driver.
    const result = await prisma.$queryRawUnsafe<any[]>(
      insertSql,
      ...valuesToInsert // Spread the filtered values as parameters
    );

    // 7. Check result and return the inserted row
    if (!result || result.length === 0) {
      // This shouldn't happen with RETURNING * on success, but good practice to check
      throw new Error(`Failed to insert row or retrieve inserted data from table "${tableName}".`);
    }

    console.log(`Row created successfully in ${tableName}:`, result[0]);
    return result[0]; // Return the first (and only) row from the result set

  } catch (error: any) {
    console.error(`Error creating row in table ${tableName}:`, error);
    // Handle specific Prisma/DB errors if needed
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // Example: Constraint violation (e.g., NOT NULL without default, UNIQUE)
      if (error.code === 'P2002' || error.code === 'P2003' || error.code === '23505' || error.code === '23503' || error.code === '23502') { // Common constraint codes
        throw new Error(`Database constraint violation while inserting into "${tableName}". Check data validity. DB Error: ${error.message}`);
      }
      // Example: Table not found
      if (error.code === 'P2025' || error.meta?.cause?.includes("does not exist")) { // P2025 might not apply here directly
         throw new Error(`Table "${tableName}" not found.`);
      }
    }
     // Example: General raw query failure check from previous error
     if (error.code === 'P2010' || error.meta?.code === '42P01') { // relation does not exist
        throw new Error(`Table "${tableName}" not found. (DB Code: ${error.meta?.code})`);
     }
    // Re-throw a generic error for other issues
    throw new Error(`Could not insert data into table "${tableName}".`);
  }
};

// ✅ CREATE column


// ✅ UPDATE row
export const updateRow = async (
  tableName: string,
  pkValue: any,
  pkColumn: string,
  rowData: Record<string, any>
): Promise<any> => {
  console.log(`Updating row in table: ${tableName} where ${pkColumn}=${pkValue}`, rowData);

  if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
    throw new Error(`Invalid table name format: ${tableName}`);
  }

  const columns = Object.keys(rowData);
  const values = Object.values(rowData);

  if (columns.length === 0) {
    throw new Error('No data provided to update.');
  }

  const setClause = columns.map((col, i) => `"${col}" = $${i + 1}`).join(', ');
  const updateSql = `UPDATE "${tableName}" SET ${setClause} WHERE "${pkColumn}" = $${columns.length + 1} RETURNING *`;
  let pkvalue = BigInt(pkValue);
  const result = await prisma.$queryRawUnsafe<any[]>(updateSql, ...values, pkvalue);

  if (!result || result.length === 0) {
    throw new Error('Record not found.');
  }

  return result[0];
};

// ✅ DELETE row
export const deleteRow = async (
  tableName: string,
  pkValue: any,
  pkColumn: string
): Promise<{ deleted: boolean }> => {
  console.log(`Deleting row from table: ${tableName} where ${pkColumn}=${pkValue}`);

  if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
    throw new Error(`Invalid table name format: ${tableName}`);
  }

  const deleteSql = `DELETE FROM "${tableName}" WHERE "${pkColumn}" = $1`;
  let pkvalue = BigInt(pkValue);
  const result = await prisma.$executeRawUnsafe(deleteSql, pkvalue);
  return { deleted: result > 0 };
};

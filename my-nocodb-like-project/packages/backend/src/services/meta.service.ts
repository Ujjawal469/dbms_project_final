import { prisma } from '../config/db';
import { Prisma } from '@prisma/client';
import * as metainterface from '../interface/meta.types';

const validateTableName = (tableName: string): string => {
 if (!tableName || tableName.trim().length === 0) {
     throw new Error('Table name cannot be empty.');
 }
 const trimmedTableName = tableName.trim();
 if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmedTableName)) {
     const error = new Error(`Invalid table name format: "${trimmedTableName}". Use letters, numbers, underscores, and start with a letter or underscore.`);
     (error as any).statusCode = 400;
     throw error;
 }

 // Check against reserved keywords
 const reservedKeywords = [
     'ALL', 'ANALYSE', 'ANALYZE', 'AND', 'ANY', 'ARRAY', 'AS', 'ASC', 'ASYMMETRIC', 'AUTHORIZATION',
     'BINARY', 'BOTH', 'CASE', 'CAST', 'CHECK', 'COLLATE', 'COLLATION', 'COLUMN', 'CONCURRENTLY',
     'CONSTRAINT', 'CREATE', 'CROSS', 'CURRENT_CATALOG', 'CURRENT_DATE', 'CURRENT_ROLE', 'CURRENT_SCHEMA',
     'CURRENT_TIME', 'CURRENT_TIMESTAMP', 'CURRENT_USER', 'DEFAULT', 'DEFERRABLE', 'DESC', 'DISTINCT',
     'DO', 'ELSE', 'END', 'EXCEPT', 'FALSE', 'FETCH', 'FOR', 'FOREIGN', 'FREEZE', 'FROM', 'FULL', 'GRANT',
     'GROUP', 'HAVING', 'ILIKE', 'IN', 'INITIALLY', 'INNER', 'INTERSECT', 'INTO', 'IS', 'ISNULL', 'JOIN',
     'LATERAL', 'LEADING', 'LEFT', 'LIKE', 'LIMIT', 'LOCALTIME', 'LOCALTIMESTAMP', 'NATURAL', 'NOT',
     'NOTNULL', 'NULL', 'OFFSET', 'ON', 'ONLY', 'OR', 'ORDER', 'OUTER', 'OVERLAPS', 'PLACING', 'PRIMARY',
     'REFERENCES', 'RETURNING', 'RIGHT', 'SELECT', 'SESSION_USER', 'SIMILAR', 'SOME', 'SYMMETRIC', 'TABLE',
     'TABLESAMPLE', 'THEN', 'TO', 'TRAILING', 'TRUE', 'UNION', 'UNIQUE', 'USER', 'USING', 'VARIADIC',
     'VERBOSE', 'WHEN', 'WHERE', 'WINDOW', 'WITH'
 ];
 if (reservedKeywords.includes(trimmedTableName.toUpperCase())) {
     const error = new Error(`Table name "${trimmedTableName}" is a reserved SQL keyword.`);
      (error as any).statusCode = 400;
      throw error;
 }

 // Length limit (PostgreSQL default is 63)
 if (trimmedTableName.length > 63) {
      const error = new Error(`Table name "${trimmedTableName}" is too long (max 63 characters).`);
      (error as any).statusCode = 400;
      throw error;
 }

 return trimmedTableName;
}

//------------------------------------------ create and adding table to database ------------------------------------------------
export const createAndAssociateTable = async (userId: number, rawTableName: string): Promise<void> => {
    const tableName = validateTableName(rawTableName);
    console.log(`Attempting to CREATE table "${tableName}" and associate with User ID ${userId}`);

    const createTableSql = `CREATE TABLE "public"."${tableName}" (serial_num SERIAL PRIMARY KEY);`;

    try {
        console.log("Executing SQL:", createTableSql);
        await prisma.$executeRawUnsafe(createTableSql);
        console.log(`Successfully CREATED physical table "${tableName}".`);
    } catch (error: any) {
        console.error(`Error CREATING physical table "${tableName}":`, error);
        if (error.code === '42P07') {
            const existsError = new Error(`Table "${tableName}" already exists in the database.`);
            (existsError as any).statusCode = 409
            throw existsError;
        }
        throw new Error(`Could not create physical table "${tableName}". Database error occurred.`);
    }

    try {
        await prisma.users_tables.create({
            data: {
                user_id: userId,
                table_name: tableName,
            },
        });
        console.log(`Successfully added table entry for User ID ${userId}, Table: ${tableName}`);
    } catch (error: any) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            const conflictError = new Error(`Table "${tableName}" is already associated with this user.`);
            (conflictError as any).statusCode = 409;
            console.warn(`Duplicate association entry blocked by DB constraint: User ${userId}, Table ${tableName}`);
            throw conflictError;
        }
        console.error(`Error adding association entry for User ${userId}, Table ${tableName}:`, error);
        throw new Error(`Could not add table association for "${tableName}" after creating table.`);
    }
};

//----------------------------------------------- get tables ----------------------------------------------
export const getTables = async (userId: number): Promise<string[]> => {
  console.log(`Fetching tables for user ID: ${userId}`);
  try {
      const userTablesResult = await prisma.users_tables.findMany({
          where: {
              user_id: userId,
          },
          select: {
              table_name: true,
          },
      });

      const tableNames = userTablesResult.map(row => row.table_name);
      console.log(`Found tables for user ${userId}:`, tableNames);
      return tableNames;
  } catch (error) {
      console.error("Error fetching tables:", error);
      throw new Error("Could not fetch tables from the database.");
  }
};


//------------------------------------------ get table schema -------------------------------------------
export const getTableSchema = async (tableName: string): Promise<metainterface.ColumnSchema[]> => {
  console.log(`Fetching schema for table: ${tableName}`);

  if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
    throw new Error(`Invalid table name format: ${tableName}`);
  }

  try {
    // It fetches column details and checks for PK and FK constraints.
    // Prisma identifiers (`"isNullable"`, etc.) need double quotes.
    // Table and column names passed as parameters to `$queryRaw` are automatically parameterized by Prisma.
    const columnsResult: metainterface.ColumnSchema[] = await prisma.$queryRaw`
      SELECT
        c.column_name AS name,
        c.data_type AS type, -- Consider udt_name for user-defined types or more detail
        CASE WHEN c.is_nullable = 'YES' THEN true ELSE false END AS "isNullable",
        c.column_default AS "defaultValue",
        -- Check for Primary Key Constraint
        (
          SELECT EXISTS (
            SELECT 1
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
            WHERE tc.constraint_type = 'PRIMARY KEY'
              AND tc.table_name = c.table_name
              AND tc.table_schema = c.table_schema
              AND kcu.column_name = c.column_name
          )
        ) AS "isPrimaryKey",
        -- Check for Foreign Key Constraint
        (
          SELECT EXISTS (
            SELECT 1
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_name = c.table_name
              AND tc.table_schema = c.table_schema
              AND kcu.column_name = c.column_name
          )
        ) AS "isForeignKey"
        -- Consider adding referenced table/column here if needed using information_schema.referential_constraints
      FROM information_schema.columns c
      WHERE c.table_schema = 'public' -- Adjust if using different schemas
        AND c.table_name = ${tableName}
      ORDER BY c.ordinal_position;
    `;

     return columnsResult.map(col => ({
       ...col,
       isNullable: Boolean(col.isNullable),
       isPrimaryKey: Boolean(col.isPrimaryKey),
       isForeignKey: Boolean(col.isForeignKey),
     }));

  } catch (error) {
    console.error(`Error fetching schema for table "${tableName}":`, error);
    throw new Error(`Could not fetch schema for table "${tableName}".`);
  }
};


interface AddColumnPayload {
    name: string;
    type: string;
    isNullable?: boolean;
    defaultValue?: any;
    isUnique?: boolean;
    // Add more constraints as needed
}

//------------------------------------------------ add new Columns ------------------------------------------------------
export const addColumn = async (tableName: string, columnData: AddColumnPayload): Promise<void> => {
    console.log(`Adding column "${columnData.name}" to table: ${tableName}`);

    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
        throw new Error(`Invalid table name format: ${tableName}`);
    }
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(columnData.name)) {
        throw new Error(`Invalid column name format: ${columnData.name}`);
    }

    const allowedTypesPattern = /^(TEXT|VARCHAR|INTEGER|INT|BIGINT|SERIAL|BIGSERIAL|NUMERIC|DECIMAL|FLOAT|REAL|DOUBLE PRECISION|BOOLEAN|BOOL|DATE|TIMESTAMP|TIMESTAMP WITH TIME ZONE|DATETIME|JSON|JSONB|UUID)(\(\d+(,\d+)?\))?$/i;
    if (!allowedTypesPattern.test(columnData.type)) {
         throw new Error(`Unsupported or invalid column type: ${columnData.type}`);
    }

    let sql = `ALTER TABLE "public"."${tableName}" ADD COLUMN "${columnData.name}" ${columnData.type}`; // Use DB-safe identifiers

    if (columnData.isNullable === false) {
        sql += ` NOT NULL`;
         if (columnData.defaultValue === undefined || columnData.defaultValue === null) {
            console.warn(`Adding NOT NULL column "${columnData.name}" without a default value might fail if table "${tableName}" is not empty.`);
         }
    } else {
        sql += ` NULL`;
    }

    if (columnData.defaultValue !== undefined && columnData.defaultValue !== null) {
        // Simple quoting for strings/text - NEEDS IMPROVEMENT FOR OTHER TYPES
        // For numbers, boolean, specific keywords like CURRENT_TIMESTAMP, no quotes needed.
        // This is complex and database-specific. Use ORM schema builder if possible.
        if (typeof columnData.defaultValue === 'string') {
             // Basic check for potential SQL keywords/functions - may need more robust handling
             if (!['CURRENT_TIMESTAMP', 'NOW()', 'uuid_generate_v4()'].includes(columnData.defaultValue.toUpperCase())) {
                // Basic string quoting, might need escaping for content
                sql += ` DEFAULT '${columnData.defaultValue.replace(/'/g, "''")}'`; // Simple single quote escape
             } else {
                 sql += ` DEFAULT ${columnData.defaultValue}`; // Assume it's a DB function/keyword
             }
        } else if (typeof columnData.defaultValue === 'number' || typeof columnData.defaultValue === 'boolean') {
             sql += ` DEFAULT ${columnData.defaultValue}`;
        } else {
             console.warn(`Default value type for "${columnData.name}" not explicitly handled: ${typeof columnData.defaultValue}. Sending as is.`);
             sql += ` DEFAULT ${columnData.defaultValue}`; // May fail depending on DB type/value
        }
    }

    // Handle Unique constraint
    if (columnData.isUnique === true) {
        // Add unique constraint separately or inline if DB supports
         // Adding separately is often cleaner:
         // sql += `; ALTER TABLE "public"."${tableName}" ADD CONSTRAINT "${tableName}_${columnData.name}_unique" UNIQUE ("${columnData.name}");`
         // Adding inline (check DB syntax):
         sql += ` UNIQUE`;
    }

    sql += `;`;

    console.log("Executing SQL:", sql);

    try {
        await prisma.$executeRawUnsafe(sql);
        console.log(`Column "${columnData.name}" added successfully.`);
    } catch (error) {
        console.error(`Error adding column "${columnData.name}" to table "${tableName}":`, error);
        throw new Error(`Could not add column "${columnData.name}" to table "${tableName}". Database error occurred.`);
    }
};

//------------------------------------------------delete table ------------------------------------------------------
export const deleteTableAndAssociation = async (userId: number, rawTableName: string): Promise<void> => {
  const tableName = validateTableName(rawTableName); // Reuse validation
  console.log(`Attempting to DELETE table "${tableName}" and its association for User ID ${userId}`);

  const association = await prisma.users_tables.findUnique({
      where: {
          user_id_table_name: {
              user_id: userId,
              table_name: tableName,
          },
      },
  });

  if (!association) {
      const error = new Error(`Table association "${tableName}" not found for this user.`);
      (error as any).statusCode = 404; 
      throw error;
  }

  try {
      await prisma.$transaction(async (tx) => {
          console.log(`TX: Deleting association for User ${userId}, Table ${tableName}`);
          await tx.users_tables.delete({
              where: {
                  user_id_table_name: {
                      user_id: userId,
                      table_name: tableName,
                  },
              },
          });
          console.log(`TX: Association deleted.`);
          const dropTableSql = `DROP TABLE IF EXISTS "public"."${tableName}";`;
          console.log("TX: Executing SQL:", dropTableSql);
          await tx.$executeRawUnsafe(dropTableSql);
          console.log(`TX: Physical table "${tableName}" dropped (if it existed).`);
      });

      console.log(`Successfully deleted table "${tableName}" and its association for User ID ${userId}.`);

  } catch (error: any) {
      console.error(`Error during transaction for deleting table ${tableName} (User: ${userId}):`, error);
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
           console.log("Highly unkown error occured");
      }
      throw new Error(`Could not delete table "${tableName}". An error occurred.`);
  }
};

//----------------------------------------------- rename table ----------------------------------------------------
export const renameTableAndAssociation = async (userId: number, oldTableNameRaw: string, newTableNameRaw: string): Promise<void> => {
    const oldTableName = validateTableName(oldTableNameRaw); 
    const newTableName = validateTableName(newTableNameRaw); 

    if (oldTableName === newTableName) {
        console.log(`Rename request ignored: old name "${oldTableName}" and new name "${newTableName}" are the same.`);
        return;
    }

    console.log(`Attempting to RENAME table "${oldTableName}" to "${newTableName}" and update association for User ID ${userId}`);


    const association = await prisma.users_tables.findUnique({
        where: { user_id_table_name: { user_id: userId, table_name: oldTableName } },
    });

    if (!association) {
        const error = new Error(`Table association "${oldTableName}" not found for this user.`);
        (error as any).statusCode = 404; 
        throw error;
    }

    const existingNewAssociation = await prisma.users_tables.findUnique({
         where: { user_id_table_name: { user_id: userId, table_name: newTableName } },
         select: { table_name: true }
    });
    if (existingNewAssociation) {
        const error = new Error(`You already have a table associated with the name "${newTableName}".`);
        (error as any).statusCode = 409; 
        throw error;
    }

    try {
        const tableExistsCheckSql = `
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = $1
            );
        `;
        const tableExistsResult = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(tableExistsCheckSql, newTableName);

        if (tableExistsResult?.[0]?.exists) {
            const error = new Error(`A table with the name "${newTableName}" already exists in the database.`);
            (error as any).statusCode = 409;
            throw error;
        }
    } catch (checkError: any) {
        console.error(`Error checking existence of potential new table name "${newTableName}":`, checkError);
        throw new Error(`Failed to verify availability of the new table name "${newTableName}".`);
    }

    try {
        await prisma.$transaction(async (tx) => {
            const renameTableSql = `ALTER TABLE "public"."${oldTableName}" RENAME TO "${newTableName}";`;
            console.log("TX: Executing SQL:", renameTableSql);
            await tx.$executeRawUnsafe(renameTableSql);
            console.log(`TX: Physical table "${oldTableName}" renamed to "${newTableName}".`);
            console.log(`TX: Updating association for User ${userId}, changing "${oldTableName}" to "${newTableName}"`);
            const updateResult = await tx.users_tables.update({
                where: {
                    user_id_table_name: {
                        user_id: userId,
                        table_name: oldTableName, 
                    },
                },
                data: {
                    table_name: newTableName,
                },
            });

            if (!updateResult) {
                 throw new Error('Failed to update the table association record during transaction.');
            }
            console.log(`TX: Association updated.`);
        });

        console.log(`Successfully renamed table "${oldTableName}" to "${newTableName}" and updated association for User ID ${userId}.`);

    } catch (error: any) {
        console.error(`Error during transaction for renaming table ${oldTableName} to ${newTableName} (User: ${userId}):`, error);
        if (error instanceof Prisma.PrismaClientKnownRequestError) {             
        } else if (error.message?.includes('already exists') || error.code === '42P07') { 
             const conflictError = new Error(`Failed to rename: target table name "${newTableName}" already exists (possibly created concurrently).`);
             (conflictError as any).statusCode = 409;
             throw conflictError;
        }
        throw new Error(`Could not rename table "${oldTableName}" to "${newTableName}". An error occurred.`);
    }
};
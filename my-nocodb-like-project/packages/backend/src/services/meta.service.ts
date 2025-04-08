// src/services/meta.service.ts (or wherever your functions are)

import { prisma } from '../config/db'; // Assuming prisma client is here
import { Prisma } from '@prisma/client';

// Keep the ColumnSchema interface, or define it here if not imported
export interface ColumnSchema {
  name: string;
  type: string;
  isPrimaryKey: boolean;
  isNullable: boolean;
  isForeignKey: boolean; // <-- Added this field
  defaultValue?: string | null;
  isUnique?: boolean; // Consider adding this too if needed later
  // Consider adding referenced table/column for FKs if needed
  // referencedTable?: string | null;
  // referencedColumn?: string | null;
}

/**
 * Fetches detailed column schema information for a specific table,
 * including primary key and foreign key status.
 */


//---------validating new table name -----------------
const validateTableName = (tableName: string): string => {
  // 1. Check for empty or whitespace-only names
 if (!tableName || tableName.trim().length === 0) {
     throw new Error('Table name cannot be empty.');
 }
 const trimmedTableName = tableName.trim();

 // 2. Check format (letters, numbers, underscores, starting with letter/underscore)
 if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmedTableName)) {
     const error = new Error(`Invalid table name format: "${trimmedTableName}". Use letters, numbers, underscores, and start with a letter or underscore.`);
     (error as any).statusCode = 400;
     throw error;
 }

 // 3. Check against reserved keywords (PostgreSQL example, needs expansion for robustness)
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

 // 4. Length limit (PostgreSQL default is 63)
 if (trimmedTableName.length > 63) {
      const error = new Error(`Table name "${trimmedTableName}" is too long (max 63 characters).`);
      (error as any).statusCode = 400;
      throw error;
 }

 return trimmedTableName; // Return validated name
}

//-----------create and adding table to database ------------------
export const createAndAssociateTable = async (userId: number, rawTableName: string): Promise<void> => {
    const tableName = validateTableName(rawTableName); // Validate and get clean name first
    console.log(`Attempting to CREATE table "${tableName}" and associate with User ID ${userId}`);

    // --- Step 1: Create the physical table ---
    // Use $executeRawUnsafe because CREATE TABLE structure isn't parameterized by Prisma.
    // Validation above is CRITICAL. Double quotes ensure case sensitivity and handle keywords if needed.
    const createTableSql = `CREATE TABLE "public"."${tableName}" (serial_num SERIAL PRIMARY KEY);`;

    try {
        console.log("Executing SQL:", createTableSql);
        await prisma.$executeRawUnsafe(createTableSql);
        console.log(`Successfully CREATED physical table "${tableName}".`);
    } catch (error: any) {
        console.error(`Error CREATING physical table "${tableName}":`, error);
        // Check for specific PostgreSQL error code for "relation already exists"
        if (error.code === '42P07') { // PostgreSQL error code for duplicate_table
            const existsError = new Error(`Table "${tableName}" already exists in the database.`);
            (existsError as any).statusCode = 409; // Conflict
            throw existsError;
        }
        // Handle other potential DB errors during creation
        throw new Error(`Could not create physical table "${tableName}". Database error occurred.`);
    }

    // --- Step 2: Add the association entry ---
    // This part is similar to the previous addTableEntry function
    try {
        await prisma.users_tables.create({
            data: {
                user_id: userId,
                table_name: tableName,
            },
        });
        console.log(`Successfully added table entry for User ID ${userId}, Table: ${tableName}`);
    } catch (error: any) {
        // Handle potential duplicate entry errors for the association table
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            const conflictError = new Error(`Table "${tableName}" is already associated with this user.`);
            (conflictError as any).statusCode = 409;
            console.warn(`Duplicate association entry blocked by DB constraint: User ${userId}, Table ${tableName}`);
            // Decide if we should rollback the physical table creation here?
            // For simplicity now, we won't, but in a real app, you might need a transaction.
            throw conflictError;
        }
        // Handle other errors during association
        console.error(`Error adding association entry for User ${userId}, Table ${tableName}:`, error);
        // If association fails after table creation, the physical table still exists!
        // Consider adding cleanup logic or using transactions for atomicity.
        throw new Error(`Could not add table association for "${tableName}" after creating table.`);
    }
};


export const getTables = async (userId: number): Promise<string[]> => {
  // ... (your existing code) ...
  console.log(`Fetching tables for user ID: ${userId}`);
  try {
      // Query the users_tables model (Prisma uses the model name)
      const userTablesResult = await prisma.users_tables.findMany({
          where: {
              user_id: userId, // Filter by the provided user ID
          },
          select: {
              table_name: true, // Select only the table_name column
          },
      });

      // Extract the table names into a simple array of strings
      const tableNames = userTablesResult.map(row => row.table_name);
      console.log(`Found tables for user ${userId}:`, tableNames);
      return tableNames;
  } catch (error) {
      console.error("Error fetching tables:", error);
      throw new Error("Could not fetch tables from the database.");
  }
};

export const getTableSchema = async (tableName: string): Promise<ColumnSchema[]> => {
  console.log(`Fetching schema for table: ${tableName}`);

  // Basic table name validation (prevents basic SQL injection)
  if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
    throw new Error(`Invalid table name format: ${tableName}`);
  }

  try {
    // This query is complex. It fetches column details and checks for PK and FK constraints.
    // Note: Prisma identifiers (`"isNullable"`, etc.) need double quotes.
    // Table and column names passed as parameters to `$queryRaw` are automatically parameterized by Prisma.
    const columnsResult: ColumnSchema[] = await prisma.$queryRaw`
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

    // Prisma might return booleans as 0/1 from raw queries depending on DB/driver, explicitly cast
     return columnsResult.map(col => ({
       ...col,
       isNullable: Boolean(col.isNullable),
       isPrimaryKey: Boolean(col.isPrimaryKey),
       isForeignKey: Boolean(col.isForeignKey),
     }));

  } catch (error) {
    console.error(`Error fetching schema for table "${tableName}":`, error);
    // Throw a more specific error if possible, e.g., check if table exists
    throw new Error(`Could not fetch schema for table "${tableName}".`);
  }
};

// --- Keep your existing getTables function ---


// --- NEW FUNCTION to Add Column ---

// Define the expected payload structure (matches frontend type ideally)
interface AddColumnPayload {
    name: string;
    type: string;
    isNullable?: boolean;
    defaultValue?: any;
    isUnique?: boolean;
    // Add more constraints as needed
}

/**
 * Adds a new column to a specified table.
 */
export const addColumn = async (tableName: string, columnData: AddColumnPayload): Promise<void> => {
    console.log(`Adding column "${columnData.name}" to table: ${tableName}`);

    // --- Input Validation ---
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
        throw new Error(`Invalid table name format: ${tableName}`);
    }
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(columnData.name)) { // Basic validation for column name
        throw new Error(`Invalid column name format: ${columnData.name}`);
    }
    // **IMPORTANT:** Add validation for allowed column types (`columnData.type`)
    // This prevents SQL injection via the type string and ensures DB compatibility.
    // Example (adapt SUPPORTED_COLUMN_TYPES from frontend or define backend list):
    const allowedTypesPattern = /^(TEXT|VARCHAR|INTEGER|INT|BIGINT|SERIAL|BIGSERIAL|NUMERIC|DECIMAL|FLOAT|REAL|DOUBLE PRECISION|BOOLEAN|BOOL|DATE|TIMESTAMP|TIMESTAMP WITH TIME ZONE|DATETIME|JSON|JSONB|UUID)(\(\d+(,\d+)?\))?$/i;
    if (!allowedTypesPattern.test(columnData.type)) {
         throw new Error(`Unsupported or invalid column type: ${columnData.type}`);
    }
    // Add validation for defaultValue type compatibility if provided

    // --- Construct ALTER TABLE Query Dynamically ---
    // **WARNING:** Building raw SQL requires careful sanitization/validation,
    // especially for identifiers like table/column names if they weren't validated above.
    // Prisma's $executeRawUnsafe is used because ALTER TABLE structure varies.
    // Parameterizing parts of ALTER TABLE is often not directly supported by ORMs.

    let sql = `ALTER TABLE "public"."${tableName}" ADD COLUMN "${columnData.name}" ${columnData.type}`; // Use DB-safe identifiers

    if (columnData.isNullable === false) {
        sql += ` NOT NULL`;
         // If adding NOT NULL, you usually NEED a default value unless table is empty
         if (columnData.defaultValue === undefined || columnData.defaultValue === null) {
            console.warn(`Adding NOT NULL column "${columnData.name}" without a default value might fail if table "${tableName}" is not empty.`);
            // Consider throwing an error or setting a DB-level default if appropriate
             // throw new Error(`A default value is required when adding a NOT NULL column "${columnData.name}" to a non-empty table.`);
         }
    } else {
        // Default to NULLable if not specified or true
        sql += ` NULL`; // Explicitly state NULL for clarity if desired, usually default
    }

    // Handle Default value (Needs careful type handling and quoting)
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

    sql += `;`; // End statement

    console.log("Executing SQL:", sql); // Log the generated SQL (for debugging)

    try {
        // Use executeRawUnsafe because ALTER TABLE structure isn't typically parameterized
        // Ensure tableName and columnData.name/type have been validated above!
        await prisma.$executeRawUnsafe(sql);
        console.log(`Column "${columnData.name}" added successfully.`);
    } catch (error) {
        console.error(`Error adding column "${columnData.name}" to table "${tableName}":`, error);
        // Check for specific DB errors if possible
        throw new Error(`Could not add column "${columnData.name}" to table "${tableName}". Database error occurred.`);
    }
};

//----------------------delete table --------------------
export const deleteTableAndAssociation = async (userId: number, rawTableName: string): Promise<void> => {
  const tableName = validateTableName(rawTableName); // Reuse validation
  console.log(`Attempting to DELETE table "${tableName}" and its association for User ID ${userId}`);

  // **CRITICAL SECURITY CHECK:** Verify the user actually owns this table association first.
  const association = await prisma.users_tables.findUnique({
      where: {
          user_id_table_name: { // Use the composite key name generated by Prisma
              user_id: userId,
              table_name: tableName,
          },
      },
  });

  if (!association) {
      // User doesn't own this table or it doesn't exist in the association table.
      // Treat as "Not Found" or "Forbidden" from the user's perspective.
      const error = new Error(`Table association "${tableName}" not found for this user.`);
      (error as any).statusCode = 404; // Or 403 Forbidden
      throw error;
  }

  // Prevent deleting core tables (add any other protected names)
  const protectedTables = ['users', 'users_tables', 'products', 'orders', 'orderitems', 'cart', 'orderaddress']; // Example
  if (protectedTables.includes(tableName.toLowerCase())) {
       const error = new Error(`Cannot delete protected system table "${tableName}".`);
       (error as any).statusCode = 403; // Forbidden
       throw error;
  }


  // Perform deletion within a transaction
  try {
      await prisma.$transaction(async (tx) => {
          // 1. Delete the association entry first (using the transaction client 'tx')
          console.log(`TX: Deleting association for User ${userId}, Table ${tableName}`);
          // We already verified association exists, so delete should succeed unless concurrent modification
          await tx.users_tables.delete({
              where: {
                  user_id_table_name: {
                      user_id: userId,
                      table_name: tableName,
                  },
              },
          });
          console.log(`TX: Association deleted.`);


          // 2. Drop the physical table (using the transaction client 'tx')
          const dropTableSql = `DROP TABLE IF EXISTS "public"."${tableName}";`; // Use IF EXISTS for safety
          console.log("TX: Executing SQL:", dropTableSql);
          await tx.$executeRawUnsafe(dropTableSql); // Must use Unsafe for DDL
          console.log(`TX: Physical table "${tableName}" dropped (if it existed).`);
      }); // End transaction

      console.log(`Successfully deleted table "${tableName}" and its association for User ID ${userId}.`);

  } catch (error: any) {
      console.error(`Error during transaction for deleting table ${tableName} (User: ${userId}):`, error);
      // Handle specific transaction or DDL errors if needed
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
           // Log specific Prisma error details
      }
      // Re-throw a generic error
      throw new Error(`Could not delete table "${tableName}". An error occurred.`);
  }
};
// src/services/meta.service.ts (or wherever your functions are)

import { prisma } from '../config/db'; // Assuming prisma client is here

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
export const getTables = async (): Promise<string[]> => {
    // ... (your existing code) ...
    console.log('Fetching tables...');
    try {
        const tablesResult: { table_name: string }[] = await prisma.$queryRaw`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name;
        `;
        return tablesResult.map(row => row.table_name);
    } catch (error) {
        console.error("Error fetching tables:", error);
        throw new Error("Could not fetch tables from the database.");
    }
};


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
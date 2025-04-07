import { prisma } from '../config/db';

/**
 * Fetches a list of user-defined table names from the connected database (PostgreSQL).
 */
export const getTables = async (): Promise<string[]> => {
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

// Interface describing the structure of a table column
export interface ColumnSchema {
  name: string;
  type: string;
  isPrimaryKey: boolean;
  isNullable: boolean;
  defaultValue?: string | null;
  isUnique?: boolean;
  // You can extend this further with foreign key metadata, etc.
}

/**
 * Fetches detailed column schema information for a specific table.
 */
export const getTableSchema = async (tableName: string): Promise<ColumnSchema[]> => {
  console.log(`Fetching schema for table: ${tableName}`);

  // Basic table name validation
  if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
    throw new Error(`Invalid table name format: ${tableName}`);
  }

  try {
    const columnsResult: ColumnSchema[] = await prisma.$queryRaw`
      SELECT 
        c.column_name AS name,
        c.data_type AS type,
        c.is_nullable::boolean AS "isNullable",
        c.column_default AS "defaultValue",
        EXISTS (
          SELECT 1 FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
          WHERE tc.constraint_type = 'PRIMARY KEY'
            AND tc.table_name = c.table_name
            AND kcu.column_name = c.column_name
        ) AS "isPrimaryKey"
      FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = ${tableName}
      ORDER BY c.ordinal_position;
    `;

    return columnsResult;
  } catch (error) {
    console.error(`Error fetching schema for table "${tableName}":`, error);
    throw new Error(`Could not fetch schema for table "${tableName}".`);
  }
};

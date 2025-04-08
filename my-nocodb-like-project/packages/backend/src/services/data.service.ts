import { prisma } from '../config/db';
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
    const columnList = currentSchema.map(col => `"${col.name}"`).join(', ');

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

  const columns = Object.keys(rowData);
  const values = Object.values(rowData);

  if (columns.length === 0) {
    throw new Error('No data provided to insert.');
  }

  const columnList = columns.map((col) => `"${col}"`).join(', ');
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

  const insertSql = `INSERT INTO "${tableName}" (${columnList}) VALUES (${placeholders}) RETURNING *`;

  const result = await prisma.$queryRawUnsafe<any[]>(insertSql, ...values);
  return result[0];
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

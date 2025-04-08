import { prisma } from '../config/db';
import { Prisma } from '@prisma/client';
import * as metaService from './meta.service';

interface PaginationOptions {
  limit: number;
  offset: number;
}

//-------------- get table data -----------------------
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
    const currentSchema = await metaService.getTableSchema(tableName);
    if (!currentSchema || currentSchema.length === 0) {
         throw new Error(`Could not retrieve schema for table "${tableName}" after potential modification.`);
    }
    const columnList = currentSchema.map(col => `"${col.name}"`).join(', ');
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

//------------------- Primary Key Column ----------------------------
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

//--------------------- new row ------------------------------
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

  for (const key in rowData) {
    if (Object.prototype.hasOwnProperty.call(rowData, key)) {
      columnsToInsert.push(key);
      valuesToInsert.push(rowData[key]);
    }
  }

  if (columnsToInsert.length === 0) {
    throw new Error('No data provided for insertion.');
  }

  const columnList = columnsToInsert.map((col) => `"${col}"`).join(', ');
  const placeholders = columnsToInsert.map((_, i) => `$${i + 1}`).join(', ');
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
    return result[0];

  } catch (error: any) {
    console.error(`Error creating row in table ${tableName}:`, error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002' || error.meta?.code === '23505') { 
         throw new Error(`Unique constraint violation in table "${tableName}". A record with this identifier (e.g., 'serial_num') might already exist. DB Error: ${error.message}`);
      }
      // Foreign key constraint violation
      if (error.code === 'P2003' || error.meta?.code === '23503') {
         throw new Error(`Foreign key constraint violation in table "${tableName}". Referenced row does not exist. DB Error: ${error.message}`);
      }
       if (error.meta?.code === '23502') {
         throw new Error(`Not-null constraint violation in table "${tableName}". A required column is missing or null. DB Error: ${error.message}`);
      }
      if (error.code === 'P2025' || error.code === 'P2010') {
         throw new Error(`Table "${tableName}" not found.`);
      }
    }
     if (error.code === '42P01') { 
        throw new Error(`Table "${tableName}" not found. (DB Code: 42P01)`);
     }
    throw new Error(`Could not insert data into table "${tableName}". Original error: ${error.message || error}`);
  }
};


//-------------------- Update Row --------------------------
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

//---------------------- Delete Row -------------------------------
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

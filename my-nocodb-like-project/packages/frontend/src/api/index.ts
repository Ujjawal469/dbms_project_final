// src/api/index.ts

import axios, { AxiosError } from 'axios'; // Import AxiosError for better typing
import {
  ApiColumnSchema,
  ApiFetchDataResponse,
  NewColumnPayload // Import the new type
} from './types';

// --- API Base URL Setup (Ensure VITE_API_URL is set in your .env file) ---
const API_BASE_URL = import.meta.env.VITE_API_URL;

if (!API_BASE_URL) {
  console.error("CRITICAL: VITE_API_URL environment variable is not set!");
  // You might want to throw an error or show a message to the user
}
console.log("🌐 API Base URL:", API_BASE_URL);

// --- Axios Client Setup ---
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000, // Increased timeout slightly for potentially longer queries
  headers: {
    'Content-Type': 'application/json', // Standard for sending JSON data
    // Add other headers like Authorization if needed:
    // 'Authorization': `Bearer ${getAuthToken()}`
  }
});

// --- Helper Function for Error Handling ---
// This centralizes error logging and potentially re-formats errors
const handleApiError = (error: AxiosError | Error, context: string): Error => {
  let errorMessage = `Unknown error in ${context}`;
  let statusCode: number | undefined = undefined;

  if (axios.isAxiosError(error)) {
    statusCode = error.response?.status;
    // Try to get message from backend response, fallback to axios message
    const backendMessage = error.response?.data?.message || error.response?.data?.error; // Adjust based on your backend's error structure
    errorMessage = backendMessage || error.message || `Request failed with status ${statusCode || 'unknown'}`;
    console.error(`🚫 API Error (${context}) - Status: ${statusCode}, Message: ${errorMessage}`, error.response?.data);
  } else if (error instanceof Error) {
    errorMessage = error.message;
    console.error(`🚫 Non-API Error (${context}):`, error);
  } else {
    console.error(`🚫 Unknown Error Type (${context}):`, error);
  }

  // Create a new error object to ensure a consistent structure is thrown
  const customError = new Error(errorMessage);
  // Optionally add status code if needed by UI logic
  // (customError as any).statusCode = statusCode;
  return customError;
};


// --- Fetch Table Names ---
export const fetchTables = async (): Promise<string[]> => {
  try {
    console.log("API: Fetching tables...");
    const res = await apiClient.get<string[]>('/meta/tables');
    console.log("API: Tables fetched successfully.");
    return res.data;
  } catch (err) {
    throw handleApiError(err as AxiosError | Error, 'fetchTables');
  }
};

// --- Fetch Schema for a Table ---
export const fetchSchema = async (tableName: string): Promise<ApiColumnSchema[]> => {
  if (!tableName) return Promise.resolve([]); // Return empty if no table name
  try {
    console.log(`API: Fetching schema for table "${tableName}"...`);
    const res = await apiClient.get<ApiColumnSchema[]>(`/meta/tables/${tableName}/schema`);
    console.log(`API: Schema for "${tableName}" fetched successfully.`);
    // Basic validation of received schema (optional)
    if (!Array.isArray(res.data)) {
        throw new Error("Invalid schema format received from server.");
    }
    return res.data;
  } catch (err) {
     throw handleApiError(err as AxiosError | Error, `fetchSchema(${tableName})`);
  }
};

// --- Fetch Paginated Data ---
export const fetchData = async (
  tableName: string,
  page: number,
  pageSize: number
  // Add filters, sorts parameters here later
): Promise<ApiFetchDataResponse> => {
   if (!tableName) return Promise.resolve({ data: [], total: 0 }); // Return empty if no table name
  try {
    console.log(`API: Fetching data for table "${tableName}" (Page: ${page}, Size: ${pageSize})...`);
    const res = await apiClient.get<ApiFetchDataResponse>(`/data/tables/${tableName}`, {
      params: { page, pageSize /*, filters, sorts */ },
    });
     console.log(`API: Data for "${tableName}" fetched successfully (Total: ${res.data?.total}).`);
    // Basic validation
     if (!res.data || !Array.isArray(res.data.data) || typeof res.data.total !== 'number') {
        throw new Error("Invalid data format received from server.");
     }
    return res.data;
  } catch (err) {
    throw handleApiError(err as AxiosError | Error, `fetchData(${tableName})`);
  }
};

// --- Create Record ---
export const createRecord = async (
  tableName: string,
  data: Record<string, any>
): Promise<any> => { // Should ideally return the created record type
  if (!tableName) throw new Error("Table name is required for creating a record.");
  try {
    console.log(`API: Creating record in table "${tableName}"...`, data);
    // Remove undefined values, backend might not handle them well
    const cleanData = Object.entries(data).reduce((acc, [key, value]) => {
        if (value !== undefined) {
            acc[key] = value;
        }
        return acc;
    }, {} as Record<string, any>);

    const res = await apiClient.post<any>(`/data/tables/${tableName}`, cleanData);
    console.log(`API: Record created in "${tableName}" successfully.`);
    return res.data; // Backend should return the created record with its ID
  } catch (err) {
    throw handleApiError(err as AxiosError | Error, `createRecord(${tableName})`);
  }
};

// --- Update Record ---
export const updateRecord = async (
  tableName: string,
  pkValue: string | number,
  data: Record<string, any>
): Promise<any> => { // Should ideally return the updated record type or success boolean
  if (!tableName || pkValue === undefined || pkValue === null) {
    throw new Error("Table name and primary key value are required for updating a record.");
  }
  try {
    const encodedPk = encodeURIComponent(String(pkValue));
    console.log(`API: Updating record in table "${tableName}" (PK: ${pkValue})...`, data);

     // Remove undefined values
     const cleanData = Object.entries(data).reduce((acc, [key, value]) => {
        if (value !== undefined) {
            acc[key] = value;
        }
        return acc;
    }, {} as Record<string, any>);

    const res = await apiClient.put<any>(`/data/tables/${tableName}/${encodedPk}`, cleanData);
    console.log(`API: Record updated in "${tableName}" (PK: ${pkValue}) successfully.`);
    return res.data; // Backend might return the updated record or just success
  } catch (err) {
     throw handleApiError(err as AxiosError | Error, `updateRecord(${tableName}, PK: ${pkValue})`);
  }
};

// --- Delete Record ---
export const deleteRecord = async (
  tableName: string,
  pkValue: string | number
): Promise<void> => {
   if (!tableName || pkValue === undefined || pkValue === null) {
    throw new Error("Table name and primary key value are required for deleting a record.");
  }
  try {
    const encodedPk = encodeURIComponent(String(pkValue));
    console.log(`API: Deleting record from table "${tableName}" (PK: ${pkValue})...`);
    await apiClient.delete(`/data/tables/${tableName}/${encodedPk}`);
    console.log(`API: Record deleted from "${tableName}" (PK: ${pkValue}) successfully.`);
    // No return value needed for successful delete
  } catch (err) {
     throw handleApiError(err as AxiosError | Error, `deleteRecord(${tableName}, PK: ${pkValue})`);
  }
};

// --- Create Column ---
export const createColumn = async (
  tableName: string,
  columnData: NewColumnPayload
): Promise<void> => { // Typically doesn't need to return anything on success
  if (!tableName) throw new Error("Table name is required for adding a column.");
   if (!columnData || !columnData.name || !columnData.type) {
     throw new Error("Column name and type are required.");
   }
  try {
    console.log(`API: Creating column "${columnData.name}" in table "${tableName}"...`, columnData);
    await apiClient.post(`/meta/tables/${tableName}/columns`, columnData);
    console.log(`API: Column "${columnData.name}" created in "${tableName}" successfully.`);
  } catch (err) {
    throw handleApiError(err as AxiosError | Error, `createColumn(${tableName})`);
  }
};

// --- Add other potential API functions as needed ---
// e.g., fetchForeignKeys(tableName, columnName), deleteColumn, updateColumn, createTable, deleteTable etc.
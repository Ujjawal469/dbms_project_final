import axios from 'axios';
import { ApiColumnSchema, ApiFetchDataResponse } from './types'; // Make sure this is correct

// --- API Base URL Setup (Vite or CRA) ---
const API_BASE_URL = import.meta.env.VITE_API_URL;

console.log("🌐 API Base URL:", API_BASE_URL);

// --- Axios Client Setup ---
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000, // 10 seconds
});

// --- Fetch Table Names ---
export const fetchTables = async (): Promise<string[]> => {
  try {
    const res = await apiClient.get<string[]>('/meta/tables');
    return res.data;
  } catch (err) {
    console.error("🚫 Error fetching tables:", err);
    throw err;
  }
};

// --- Fetch Schema for a Table ---
export const fetchSchema = async (tableName: string): Promise<ApiColumnSchema[]> => {
  try {
    const res = await apiClient.get<ApiColumnSchema[]>(`/meta/tables/${tableName}/schema`);
    return res.data;
  } catch (err) {
    console.error(`🚫 Error fetching schema for ${tableName}:`, err);
    throw err;
  }
};

// --- Fetch Paginated Data ---
export const fetchData = async (
  tableName: string,
  page: number,
  pageSize: number
): Promise<ApiFetchDataResponse> => {
  try {
    const res = await apiClient.get<ApiFetchDataResponse>(`/data/tables/${tableName}`, {
      params: { page, pageSize },
    });
    return res.data;
  } catch (err) {
    console.error(`🚫 Error fetching data for ${tableName}:`, err);
    throw err;
  }
};

// --- Create Record ---
export const createRecord = async (
  tableName: string,
  data: Record<string, any>
): Promise<any> => {
  try {
    const res = await apiClient.post<any>(`/data/tables/${tableName}`, data);
    return res.data;
  } catch (err) {
    console.error(`🚫 Error creating record in ${tableName}:`, err);
    throw err;
  }
};

// --- Update Record ---
export const updateRecord = async (
  tableName: string,
  pkValue: string | number,
  data: Record<string, any>
): Promise<any> => {
  try {
    const encodedPk = encodeURIComponent(String(pkValue));
    const res = await apiClient.put<any>(`/data/tables/${tableName}/${encodedPk}`, data);
    return res.data;
  } catch (err) {
    console.error(`🚫 Error updating record in ${tableName} (PK: ${pkValue}):`, err);
    throw err;
  }
};

// --- Delete Record ---
export const deleteRecord = async (
  tableName: string,
  pkValue: string | number
): Promise<void> => {
  try {
    const encodedPk = encodeURIComponent(String(pkValue));
    await apiClient.delete(`/data/tables/${tableName}/${encodedPk}`);
  } catch (err) {
    console.error(`🚫 Error deleting record from ${tableName} (PK: ${pkValue}):`, err);
    throw err;
  }
};

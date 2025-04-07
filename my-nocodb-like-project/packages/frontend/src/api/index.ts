// src/api/index.ts

import axios from 'axios';
import { ApiColumnSchema, ApiFetchDataResponse } from './types';

const API_BASE_URL = import.meta.env.VITE_API_URL;

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

export const fetchTables = async (): Promise<string[]> => {
  const res = await apiClient.get<string[]>('/meta/tables');
  return res.data;
};

export const fetchSchema = async (tableName: string): Promise<ApiColumnSchema[]> => {
  const res = await apiClient.get<ApiColumnSchema[]>(`/meta/tables/${tableName}/schema`);
  return res.data;
};

export const fetchData = async (
  tableName: string,
  page: number,
  pageSize: number
): Promise<ApiFetchDataResponse> => {
  const res = await apiClient.get<ApiFetchDataResponse>(`/data/tables/${tableName}`, {
    params: { page, pageSize },
  });
  return res.data;
};

export const createRecord = async (
  tableName: string,
  data: Record<string, any>
): Promise<any> => {
  const res = await apiClient.post(`/data/tables/${tableName}`, data);
  return res.data;
};

export const updateRecord = async (
  tableName: string,
  pkValue: string | number,
  data: Record<string, any>
): Promise<any> => {
  const encodedPk = encodeURIComponent(String(pkValue));
  const res = await apiClient.put(`/data/tables/${tableName}/${encodedPk}`, data);
  return res.data;
};

export const deleteRecord = async (
  tableName: string,
  pkValue: string | number
): Promise<void> => {
  const encodedPk = encodeURIComponent(String(pkValue));
  await apiClient.delete(`/data/tables/${tableName}/${encodedPk}`);
};

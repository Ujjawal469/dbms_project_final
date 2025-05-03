// src/api/index.ts

import axios, { AxiosError, AxiosProgressEvent } from 'axios';
import {
  ApiColumnSchema,
  ApiFetchDataResponse,
  NewColumnPayload,
  LoginCredentials,
  SignupCredentials,
  LoggedInUser,
  FilterCondition,
} from './types';

// ------------------------------ API Base URL Setup from .env ---------------------------------
const API_BASE_URL = import.meta.env.VITE_API_URL;

if (!API_BASE_URL) {
  console.error("CRITICAL: VITE_API_URL environment variable is not set!");
}
console.log("🌐 API Base URL:", API_BASE_URL);

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000, 
  headers: {
    'Content-Type': 'application/json', 
  }
});

const handleApiError = (error: AxiosError | Error, context: string): Error => {
  let errorMessage = `Unknown error in ${context}`;
  let statusCode: number | undefined = undefined;

  if (axios.isAxiosError(error)) {
    statusCode = error.response?.status;
    const backendMessage = error.response?.data?.message || error.response?.data?.error;
    errorMessage = backendMessage || error.message || `Request failed with status ${statusCode || 'unknown'}`;
    console.error(`🚫 API Error (${context}) - Status: ${statusCode}, Message: ${errorMessage}`, error.response?.data);
  } else if (error instanceof Error) {
    errorMessage = error.message;
    console.error(`🚫 Non-API Error (${context}):`, error);
  } else {
    console.error(`🚫 Unknown Error Type (${context}):`, error);
  }

  const customError = new Error(errorMessage);
  return customError;
};

//------------------------------ checking Login status ----------------------------------
export const checkLoginStatus = async (): Promise<{ loggedIn: boolean, user: LoggedInUser | null }> => {
  try {
    console.log("API: Checking login status...");
    const response = await apiClient.get('user/isLoggedIn', { withCredentials: true });
    if (response?.data?.loggedIn && response?.data?.user) {
      console.log(`API: User is logged in: ${response.data.user.username}`);
      return response.data as { loggedIn: true, user: LoggedInUser };
    } else {
      console.log("API: Received success status, but response data indicates not logged in.");
      return { loggedIn: false, user: null };
    }

  } catch (err) {
    const axiosError = err as AxiosError; 
    if (axiosError.response && axiosError.response.status === 401) {
      console.log("API: User not logged in (received 401).");
      return { loggedIn: false, user: null };
    }
    const processedError = handleApiError(axiosError, 'checkLoginStatus');
    if (processedError.message === "User not logged in") {
        console.log("API: User not logged in (processed error message).");
       return { loggedIn: false, user: null };
    }
    console.error("API: Unexpected error checking login status:", processedError);
    throw processedError;
  }
};

// ------------------------------------------------- Login User -----------------------------------------------
// LoginCredentials { email: string; password: string; }
export const loginUser = async (credentials: LoginCredentials): Promise<any> => {
  try {
    console.log("API: Attempting login...");
    const response = await apiClient.post('/user/login', credentials, { withCredentials: true });
    console.log("API: Login successful.");
    return response.data;
  } catch (err) {
    throw handleApiError(err as AxiosError | Error, 'loginUser');
  }
};


//-----------------------------------------------signup-user--------------------------------------------------
export const signupUser = async (credentials: SignupCredentials): Promise<any> => {
  if (!credentials.username || !credentials.email || !credentials.password) {
      throw new Error("Username, email, and password are required for signup.");
  }
  try {
      console.log("API: Attempting signup...");
      const response = await apiClient.post('/user/signup', credentials, { withCredentials: true });
      console.log("API: Signup successful.");
      return response.data;
  } catch (err) {
      throw handleApiError(err as AxiosError | Error, 'signupUser');
  }
};


//------------------------------------------------add table ---------------------------------------------------
export const addTable = async (tableName: string): Promise<{ message: string, tableName: string }> => {
  if (!tableName || tableName.trim().length === 0) {
    throw new Error("Table name cannot be empty.");
  }
  try {
    const trimmedTableName = tableName.trim();
    console.log(`API: Adding table entry "${trimmedTableName}"...`);
    const response = await apiClient.post<{ message: string, tableName: string }>(
        '/meta/tables',
        { tableName: trimmedTableName },
        { withCredentials: true }
    );
    console.log(`API: Table entry "${trimmedTableName}" added successfully.`);
    return response.data;
  } catch (err) {
    throw handleApiError(err as AxiosError | Error, `addTable(${tableName})`);
  }
};


// -------------------------- Fetch Table Names --------------------------------------
export const fetchTables = async (): Promise<string[]> => {
  try {
    console.log("API: Fetching tables...");
    const res = await apiClient.get<string[]>('/meta/tables', { withCredentials: true });
    console.log("API: Tables fetched successfully.");
    return res.data;
  } catch (err) {
    throw handleApiError(err as AxiosError | Error, 'fetchTables');
  }
};

export const fetchSchema = async (tableName: string): Promise<ApiColumnSchema[]> => {
  if (!tableName) return Promise.resolve([]); 
  try {
    console.log(`API: Fetching schema for table "${tableName}"...`);
    const res = await apiClient.get<ApiColumnSchema[]>(`/meta/tables/${tableName}/schema`, { withCredentials: true });
    console.log(`API: Schema for "${tableName}" fetched successfully.`);
    if (!Array.isArray(res.data)) {
        throw new Error("Invalid schema format received from server.");
    }
    return res.data;
  } catch (err) {
     throw handleApiError(err as AxiosError | Error, `fetchSchema(${tableName})`);
  }
};

// ------------------------------------- Fetch Paginated Data ---------------------------------
export const fetchData = async (
  tableName: string, // <<< Added tableName back as the first argument
  params: { // <<< params object as the second argument
      page: number;
      limit: number; // Use 'limit' for backend convention
      filters?: FilterCondition[];
      search?: string;
      sort_by?: string;
      sort_order?: 'asc' | 'desc';
      group_by?: string;
      // Add other potential parameters here
  }
): Promise<ApiFetchDataResponse> => {
   // Check for tableName early
   if (!tableName) {
       console.warn("API: fetchData called without tableName.");
       return Promise.resolve({ data: [], total: 0 });
   }

   // Prepare the parameters object that will be sent to axios
   const requestParams: Record<string, any> = {
      page: params.page,
      limit: params.limit,
      // Conditionally add other simple parameters if they are provided
      ...(params.search && { search: params.search }),
      ...(params.sort_by && { sort_by: params.sort_by }),
      ...(params.sort_order && { sort_order: params.sort_order }),
      ...(params.group_by && { group_by: params.group_by }),
   };

   // Handle filters: Stringify if they exist and are not empty
   if (params.filters && Array.isArray(params.filters) && params.filters.length > 0) {
      try {
          requestParams.filters = JSON.stringify(params.filters);
          // Optional: Log the stringified filters for debugging
          // console.log("API: Sending stringified filters:", requestParams.filters);
      } catch (e) {
          console.error("API: Error stringifying filters, sending request without them.", e);
          // Decide if you want to throw an error or proceed without filters
      }
   }

  try {
    // Log the actual request being made
    console.log(`API: Fetching data for table "${tableName}" with params:`, requestParams);

    // Make the GET request with the prepared params
    const res = await apiClient.get<ApiFetchDataResponse>(`/data/tables/${tableName}`, {
      params: requestParams, // Pass the prepared params object here
      withCredentials: true
    });

     // Standard response validation
     console.log(`API: Data for "${tableName}" fetched successfully (Total: ${res.data?.total}).`);
     if (!res.data || !Array.isArray(res.data.data) || typeof res.data.total !== 'number') {
        throw new Error("Invalid data format received from server.");
     }
    return res.data;
  } catch (err) {
     // Add stringified params to error context for better debugging
     let paramsString = "{ PII Filtered }"; // Avoid logging potentially sensitive filter values directly
     try {
         // Attempt to stringify params for logging, potentially redacting sensitive parts if needed
         paramsString = JSON.stringify(requestParams);
     } catch { /* ignore stringify error for logging */ }
     const context = `fetchData(tableName: ${tableName}, params: ${paramsString})`;
     throw handleApiError(err as AxiosError | Error, context);
  }
};

// ----------------- Create Record ----------------------
export const createRecord = async (
  tableName: string,
  data: Record<string, any>
): Promise<any> => {
  if (!tableName) throw new Error("Table name is required for creating a record.");
  try {
    console.log(`API: Creating record in table "${tableName}"...`, data);
    const cleanData = Object.entries(data).reduce((acc, [key, value]) => {
        if (value !== undefined) {
            acc[key] = value;
        }
        return acc;
    }, {} as Record<string, any>);

    const res = await apiClient.post<any>(`/data/tables/${tableName}`, cleanData, { withCredentials: true });
    console.log(`API: Record created in "${tableName}" successfully.`);
    return res.data;
  } catch (err) {
    throw handleApiError(err as AxiosError | Error, `createRecord(${tableName})`);
  }
};

// -------------------------- Update Record ------------------------------
export const updateRecord = async (
  tableName: string,
  pkValue: string | number,
  data: Record<string, any>
): Promise<any> => {
  if (!tableName || pkValue === undefined || pkValue === null) {
    throw new Error("Table name and primary key value are required for updating a record.");
  }
  try {
    const encodedPk = encodeURIComponent(String(pkValue));
    console.log(`API: Updating record in table "${tableName}" (PK: ${pkValue})...`, data);

     const cleanData = Object.entries(data).reduce((acc, [key, value]) => {
        if (value !== undefined) {
            acc[key] = value;
        }
        return acc;
    }, {} as Record<string, any>);

    const res = await apiClient.put<any>(`/data/tables/${tableName}/${encodedPk}`, cleanData, { withCredentials: true });
    console.log(`API: Record updated in "${tableName}" (PK: ${pkValue}) successfully.`);
    return res.data;
  } catch (err) {
     throw handleApiError(err as AxiosError | Error, `updateRecord(${tableName}, PK: ${pkValue})`);
  }
};

// ----------------------------------- Delete Record -----------------------------------
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
    await apiClient.delete(`/data/tables/${tableName}/${encodedPk}`, { withCredentials: true });
    console.log(`API: Record deleted from "${tableName}" (PK: ${pkValue}) successfully.`);
  } catch (err) {
     throw handleApiError(err as AxiosError | Error, `deleteRecord(${tableName}, PK: ${pkValue})`);
  }
};

// -------------------------------- Create Column -------------------------------
export const createColumn = async (
  tableName: string,
  columnData: NewColumnPayload
): Promise<void> => {
  if (!tableName) throw new Error("Table name is required for adding a column.");
   if (!columnData || !columnData.name || !columnData.type) {
     throw new Error("Column name and type are required.");
   }
  try {
    console.log(`API: Creating column "${columnData.name}" in table "${tableName}"...`, columnData);
    await apiClient.post(`/meta/tables/${tableName}/columns`, columnData, { withCredentials: true });
    console.log(`API: Column "${columnData.name}" created in "${tableName}" successfully.`);
  } catch (err) {
    throw handleApiError(err as AxiosError | Error, `createColumn(${tableName})`);
  }
};

//------------------------------------ delete table -----------------------------------
export const deleteTable = async (tableName: string): Promise<void> => {
  if (!tableName || tableName.trim().length === 0) {
    throw new Error("Table name cannot be empty.");
  }
  try {
    const trimmedTableName = tableName.trim();
    const encodedTableName = encodeURIComponent(trimmedTableName);
    console.log(`API: Deleting table "${trimmedTableName}"...`);
    await apiClient.delete(
        `/meta/tables/${encodedTableName}`,
        { withCredentials: true }
    );
    console.log(`API: Table "${trimmedTableName}" deleted request sent successfully.`);
  } catch (err) {
    throw handleApiError(err as AxiosError | Error, `deleteTable(${tableName})`);
  }
};

//----------------------- rename table --------------------------------------
export const renameTable = async (oldTableName: string, newTableName: string): Promise<{ message: string, oldTableName: string, newTableName: string }> => {
  if (!oldTableName || oldTableName.trim().length === 0) throw new Error("Current table name cannot be empty.");
  if (!newTableName || newTableName.trim().length === 0) throw new Error("New table name cannot be empty.");
  if (oldTableName.trim() === newTableName.trim()) throw new Error("New name cannot be the same as the old name.");

  try {
    const trimmedOldName = oldTableName.trim();
    const trimmedNewName = newTableName.trim();
    const encodedOldName = encodeURIComponent(trimmedOldName);

    console.log(`API: Renaming table "${trimmedOldName}" to "${trimmedNewName}"...`);

    // Use PATCH method
    const response = await apiClient.patch<{ message: string, oldTableName: string, newTableName: string }>(
        `/meta/tables/${encodedOldName}`, // Pass old name in URL
        { newTableName: trimmedNewName }, // Pass new name in request body
        { withCredentials: true } // Requires authentication
    );
    console.log(`API: Table rename request sent successfully for "${trimmedOldName}".`);
    return response.data;
  } catch (err) {
    throw handleApiError(err as AxiosError | Error, `renameTable(${oldTableName}, ${newTableName})`);
  }
};

//---------------------------- logout user -------------------------------------------------

export const logoutUser = async (): Promise<void> => {
  try {
    console.log("API: Logging out...");
    await apiClient.post('/user/logout', {}, { withCredentials: true });
    console.log("API: Logout successful.");
  } catch (err) {
    throw handleApiError(err as AxiosError | Error, 'logoutUser');
  }
};

//--------------------------- uploadData ----------------------------------------------------
export const uploadData = async (
  tableName: string,
  formData: FormData,
  onUploadProgress?: (progressEvent: AxiosProgressEvent) => void
): Promise<any> => {
  if (!tableName) {
    throw new Error("Table name is required for uploading data.");
  }
  if (!formData.has('file')) {
     throw new Error("FormData must contain a 'file' entry.");
  }

  try {
    console.log(`API: Uploading data for table "${tableName}"...`);
    const response = await apiClient.post<any>(
      `/data/tables/${tableName}/upload`,
      formData,
      {
        withCredentials: true,
        onUploadProgress: onUploadProgress
      }
    );
    console.log(`API: Data upload for "${tableName}" successful.`);
    return response.data;
  } catch (err) {
    throw handleApiError(err as AxiosError | Error, `uploadData(${tableName})`);
  }
};
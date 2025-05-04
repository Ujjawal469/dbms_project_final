// src/api/index.ts
import axios, { AxiosError, AxiosProgressEvent } from 'axios';
import {
    ApiColumnSchema, ApiFetchDataResponse, NewColumnPayload,
    LoginCredentials, SignupCredentials, LoggedInUser,
    ApiDatabase, ApiTableInfo, AddTableResponse, RenameTableResponse,
    AddDatabaseResponse, RenameDatabaseResponse, FilterCondition
    // Make sure all these types are defined and exported from './types'
} from './types';

// --- API Base URL Setup ---
// Use the || '/api' fallback from Commit 2 as it's safer if .env is missing
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
console.log("🌐 API Base URL:", API_BASE_URL);

// --- Axios Client Setup ---
// Use the setup from Commit 2 which includes withCredentials by default
const apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 15000, // Reasonable timeout
    withCredentials: true // Send cookies for session management
});

// --- Error Handling ---
// Use the refined error handler from Commit 2
const handleApiError = (error: AxiosError | Error, context: string): Error => {
    let errorMessage = `Unknown error in ${context}`;
    let statusCode: number | undefined = undefined;

    if (axios.isAxiosError(error)) {
        statusCode = error.response?.status;
        // Prioritize specific error/message fields from backend response
        const backendError = error.response?.data?.error || error.response?.data?.message;
        errorMessage = backendError || error.message || `Request failed with status ${statusCode || 'unknown'}`;
        console.error(`🚫 API Error (${context}) - Status: ${statusCode}, Message: ${errorMessage}`, error.response?.data);
    } else if (error instanceof Error) {
        errorMessage = error.message;
        console.error(`🚫 Non-API Error (${context}):`, error);
    } else {
        console.error(`🚫 Unknown Error Type (${context}):`, error);
    }
    // Create a new error object to preserve stack trace if needed, but with better message
    const customError = new Error(errorMessage);
    // Optionally attach status code if needed downstream
    // (customError as any).statusCode = statusCode;
    return customError;
};


// --- Authentication ---

export const checkLoginStatus = async (): Promise<{ loggedIn: boolean, user: LoggedInUser | null }> => {
    try {
        console.log("API: Checking login status...");
        // Use endpoint from Commit 2
        const response = await apiClient.get<{ loggedIn: boolean, user: LoggedInUser | null }>('user/isLoggedIn');

        // Handle potential string IDs (from Commit 2)
        if (response.data?.user?.user_id) {
            response.data.user.user_id = Number(response.data.user.user_id);
        }

        // Check boolean flag as well
        if (response.data?.loggedIn && response.data?.user) {
            console.log(`API: User is logged in: ${response.data.user.username} (ID: ${response.data.user.user_id})`);
            return response.data as { loggedIn: true, user: LoggedInUser };
        } else {
             console.log("API: Response indicates user not logged in.", response.data);
             return { loggedIn: false, user: null };
        }
    } catch (err) {
        const axiosError = err as AxiosError;
        if (axiosError.response && axiosError.response.status === 401) {
            console.log("API: User not logged in (received 401).");
            return { loggedIn: false, user: null };
        }
        // Use handleApiError for other errors, but still return not logged in for consistency
        const processedError = handleApiError(axiosError, 'checkLoginStatus');
        console.error("API: Unexpected error checking login status:", processedError);
        return { loggedIn: false, user: null }; // Treat unexpected errors as not logged in
    }
};

export const loginUser = async (credentials: LoginCredentials): Promise<LoggedInUser> => {
    try {
        console.log("API: Attempting login...");
        const response = await apiClient.post<{ message: string, user: LoggedInUser }>('/user/login', credentials);
        console.log("API: Login successful.");
        // Handle potential string IDs (from Commit 2)
        if (response.data.user?.user_id) {
            response.data.user.user_id = Number(response.data.user.user_id);
        }
        if (!response.data.user) {
            throw new Error("Login response did not include user data.");
        }
        return response.data.user;
    } catch (err) {
        throw handleApiError(err as AxiosError | Error, 'loginUser');
    }
};

export const signupUser = async (credentials: SignupCredentials): Promise<any> => {
    // Add validation from Commit 1
    if (!credentials.username || !credentials.email || !credentials.password) {
        throw new Error("Username, email, and password are required for signup.");
    }
    try {
        console.log("API: Attempting signup...");
        const response = await apiClient.post('/user/signup', credentials);
        console.log("API: Signup successful.");
        return response.data; // Return full response data
    } catch (err) {
        throw handleApiError(err as AxiosError | Error, 'signupUser');
    }
};

export const logoutUser = async (): Promise<void> => {
    try {
        console.log("API: Logging out...");
        await apiClient.post('/user/logout', {}); // Empty body
        console.log("API: Logout successful.");
    } catch (err) {
        throw handleApiError(err as AxiosError | Error, 'logoutUser');
    }
};


// --- Database Management --- (From Commit 2)

export const fetchDatabases = async (): Promise<ApiDatabase[]> => {
    try {
        console.log("API: Fetching databases...");
        const res = await apiClient.get<ApiDatabase[]>('/meta/databases');
        console.log(`API: Databases fetched successfully (${res.data.length} found).`);
        // Handle potential string IDs
        return res.data.map(db => ({
            ...db,
            user_id: Number(db.user_id),
            db_id: Number(db.db_id)
        }));
    } catch (err) {
        throw handleApiError(err as AxiosError | Error, 'fetchDatabases');
    }
};

export const addDatabase = async (dbName: string): Promise<AddDatabaseResponse> => {
    if (!dbName || dbName.trim().length === 0) throw new Error("Database name cannot be empty.");
    try {
        const trimmedDbName = dbName.trim();
        console.log(`API: Adding database "${trimmedDbName}"...`);
        const response = await apiClient.post<AddDatabaseResponse>(
            '/meta/databases',
            { dbName: trimmedDbName } // Send in body
        );
        console.log(`API: Database "${trimmedDbName}" added successfully.`);
        // Handle potential string IDs in response
        if (response.data.database) {
             response.data.database.user_id = Number(response.data.database.user_id);
             response.data.database.db_id = Number(response.data.database.db_id);
        }
        return response.data;
    } catch (err) {
        throw handleApiError(err as AxiosError | Error, `addDatabase(${dbName})`);
    }
};

export const renameDatabase = async (dbId: number, newDbName: string): Promise<RenameDatabaseResponse> => {
    if (!dbId) throw new Error("Database ID is required for renaming.");
    if (!newDbName || newDbName.trim().length === 0) throw new Error("New database name cannot be empty.");
    try {
        const trimmedNewName = newDbName.trim();
        console.log(`API: Renaming database ID ${dbId} to "${trimmedNewName}"...`);
        // Use PATCH as in Commit 1's renameTable
        const response = await apiClient.patch<RenameDatabaseResponse>(
            `/meta/databases/${dbId}`,
            { newDbName: trimmedNewName } // Send in body
        );
        console.log(`API: Database rename request sent successfully for ID ${dbId}.`);
        // Handle potential string IDs in response
        if (response.data.database) {
             response.data.database.user_id = Number(response.data.database.user_id);
             response.data.database.db_id = Number(response.data.database.db_id);
        }
        return response.data;
    } catch (err) {
        throw handleApiError(err as AxiosError | Error, `renameDatabase(ID: ${dbId}, NewName: ${newDbName})`);
    }
};

export const deleteDatabase = async (dbId: number): Promise<void> => {
    if (!dbId) throw new Error("Database ID is required for deletion.");
    try {
        console.log(`API: Deleting database ID ${dbId}...`);
        await apiClient.delete(`/meta/databases/${dbId}`);
        console.log(`API: Database delete request sent successfully for ID ${dbId}.`);
    } catch (err) {
        throw handleApiError(err as AxiosError | Error, `deleteDatabase(ID: ${dbId})`);
    }
};


// --- Table Management (within a Database) --- (Using Commit 2 structure)

export const fetchTables = async (dbId: number): Promise<ApiTableInfo[]> => {
    if (!dbId) {
        console.warn("API: fetchTables called with invalid dbId.");
        return Promise.resolve([]);
    }
    try {
        console.log(`API: Fetching tables for database ID: ${dbId}...`);
        const res = await apiClient.get<ApiTableInfo[]>(`/meta/databases/${dbId}/tables`);
        console.log(`API: Tables fetched successfully for DB ${dbId} (${res.data.length} found).`);
        // Handle potential string IDs
        return res.data.map(table => ({
             ...table,
             table_id: Number(table.table_id) // Assuming table_id is sent and needs conversion
        }));
    } catch (err) {
        throw handleApiError(err as AxiosError | Error, `fetchTables(DB ID: ${dbId})`);
    }
};

export const addTable = async (dbId: number, tableName: string): Promise<AddTableResponse> => {
    if (!dbId) throw new Error("Database ID is required to add a table.");
    if (!tableName || tableName.trim().length === 0) throw new Error("Table name cannot be empty.");
    try {
        const trimmedTableName = tableName.trim();
        console.log(`API: Adding table "${trimmedTableName}" to DB ID ${dbId}...`);
        const response = await apiClient.post<AddTableResponse>(
            `/meta/databases/${dbId}/tables`,
            { tableName: trimmedTableName } // Send in body
        );
        console.log(`API: Table "${trimmedTableName}" added successfully to DB ${dbId}.`);
        // Handle potential string IDs in response
         if (response.data.table) {
             response.data.table.user_id = Number(response.data.table.user_id);
             response.data.table.db_id = Number(response.data.table.db_id);
             response.data.table.table_id = Number(response.data.table.table_id);
         }
        return response.data;
    } catch (err) {
        throw handleApiError(err as AxiosError | Error, `addTable(DB ID: ${dbId}, Name: ${tableName})`);
    }
};

export const deleteTable = async (dbId: number, tableName: string): Promise<void> => {
    if (!dbId || !tableName || tableName.trim().length === 0) throw new Error("DB ID and valid Table name are required.");
    try {
        const trimmedTableName = tableName.trim();
        const encodedTableName = encodeURIComponent(trimmedTableName);
        console.log(`API: Deleting table "${trimmedTableName}" from DB ID ${dbId}...`);
        await apiClient.delete(`/meta/databases/${dbId}/tables/${encodedTableName}`);
        console.log(`API: Table "${trimmedTableName}" delete request sent successfully for DB ${dbId}.`);
    } catch (err) {
        throw handleApiError(err as AxiosError | Error, `deleteTable(DB ID: ${dbId}, Table: ${tableName})`);
    }
};

export const renameTable = async (dbId: number, oldTableName: string, newTableName: string): Promise<RenameTableResponse> => {
    if (!dbId) throw new Error("Database ID is required.");
    if (!oldTableName || oldTableName.trim().length === 0) throw new Error("Current table name cannot be empty.");
    if (!newTableName || newTableName.trim().length === 0) throw new Error("New table name cannot be empty.");
    if (oldTableName.trim() === newTableName.trim()) throw new Error("New name cannot be the same as the old name.");

    try {
        const trimmedOldName = oldTableName.trim();
        const trimmedNewName = newTableName.trim();
        const encodedOldName = encodeURIComponent(trimmedOldName);

        console.log(`API: Renaming table "${trimmedOldName}" to "${trimmedNewName}" in DB ID ${dbId}...`);
        // Use PATCH as in Commit 1
        const response = await apiClient.patch<RenameTableResponse>(
            `/meta/databases/${dbId}/tables/${encodedOldName}`,
            { newTableName: trimmedNewName } // Send in body
        );
        console.log(`API: Table rename request sent successfully for "${trimmedOldName}" in DB ${dbId}.`);
        // Handle potential string IDs in response
        if (response.data.table) {
            response.data.table.user_id = Number(response.data.table.user_id);
            response.data.table.db_id = Number(response.data.table.db_id);
            response.data.table.table_id = Number(response.data.table.table_id);
        }
        return response.data;
    } catch (err) {
        throw handleApiError(err as AxiosError | Error, `renameTable(DB ID: ${dbId}, Old: ${oldTableName}, New: ${newTableName})`);
    }
};


// --- Schema and Column Management (within a Database/Table) ---

export const fetchSchema = async (dbId: number, tableName: string): Promise<ApiColumnSchema[]> => {
    if (!dbId || !tableName) {
        console.warn("API: fetchSchema called with invalid dbId or tableName.");
        return Promise.resolve([]);
    }
    try {
        const encodedTableName = encodeURIComponent(tableName.trim());
        console.log(`API: Fetching schema for table "${tableName}" in DB ID ${dbId}...`);
        const res = await apiClient.get<ApiColumnSchema[]>(`/meta/databases/${dbId}/tables/${encodedTableName}/schema`);
        console.log(`API: Schema for "${tableName}" (DB ${dbId}) fetched successfully.`);
        if (!Array.isArray(res.data)) {
            throw new Error("Invalid schema format received from server.");
        }
        // Ensure boolean conversions (like Commit 2)
         return res.data.map(col => ({
             ...col,
             // Ensure these fields exist and handle potential non-boolean values safely
             isPrimaryKey: Boolean(col.isPrimaryKey),
             isNullable: Boolean(col.isNullable),
             isForeignKey: Boolean(col.isForeignKey),
             isAutoGenerated: Boolean(col.isAutoGenerated) // Added from Commit 2 logic
         }));
    } catch (err) {
        throw handleApiError(err as AxiosError | Error, `fetchSchema(DB ID: ${dbId}, Table: ${tableName})`);
    }
};

export const createColumn = async (
    dbId: number,
    tableName: string,
    columnData: NewColumnPayload
): Promise<void> => {
    if (!dbId || !tableName) throw new Error("DB ID and Table name are required for adding a column.");
    if (!columnData || !columnData.name || !columnData.type) throw new Error("Column name and type are required.");
    try {
        const encodedTableName = encodeURIComponent(tableName.trim());
        console.log(`API: Creating column "${columnData.name}" in table "${tableName}" (DB ${dbId})...`, columnData);
        // Use endpoint from Commit 2
        await apiClient.post(`/meta/databases/${dbId}/tables/${encodedTableName}/columns`, columnData);
        console.log(`API: Column "${columnData.name}" created in "${tableName}" (DB ${dbId}) successfully.`);
    } catch (err) {
        throw handleApiError(err as AxiosError | Error, `createColumn(DB ID: ${dbId}, Table: ${tableName})`);
    }
};


// --- Data Fetching and Manipulation (within a Database/Table) ---

export const fetchData = async (
    dbId: number,
    tableName: string,
    params: {
        page: number;
        limit: number;
        filters?: FilterCondition[];
        search?: string;
        sort_by?: string;
        sort_order?: 'asc' | 'desc';
        group_by?: string[];
    }
): Promise<ApiFetchDataResponse> => {
    if (!dbId || !tableName) {
        console.warn("API: fetchData called with invalid dbId or tableName.");
        return Promise.resolve({ data: [], total: 0 });
    }

    // Prepare request parameters (same logic as Commit 1, verified)
    const requestParams: Record<string, any> = {
        page: params.page,
        limit: params.limit,
        ...(params.search && { search: params.search }),
        ...(params.sort_by && { sort_by: params.sort_by }),
        ...(params.sort_order && { sort_order: params.sort_order }),
        ...(params.group_by && { group_by: params.group_by }),
    };
    if (params.filters && Array.isArray(params.filters) && params.filters.length > 0) {
        try {
            requestParams.filters = JSON.stringify(params.filters);
        } catch (e) {
            console.error("API: Error stringifying filters, sending request without them.", e);
        }
     }

    try {
        const encodedTableName = encodeURIComponent(tableName.trim());
        console.log(`API: Fetching data for table "${tableName}" (DB ${dbId}) with params:`, requestParams);
        // *** IMPORTANT: Use the correct endpoint with dbId ***
        const res = await apiClient.get<ApiFetchDataResponse>(
            `/data/${dbId}/tables/${encodedTableName}`, // Use endpoint structure like Commit 2's other data calls
            { params: requestParams } // No need for withCredentials here if it's default
        );
        console.log(`API: Data for "${tableName}" (DB ${dbId}) fetched successfully (Total: ${res.data?.total}).`);
        if (!res.data || !Array.isArray(res.data.data) || typeof res.data.total !== 'number') {
            throw new Error("Invalid data format received from server.");
        }
        // No explicit number conversion needed here, assuming data rows are correct type
        return res.data;
    } catch (err) {
        throw handleApiError(err as AxiosError | Error, `fetchData(DB ID: ${dbId}, Table: ${tableName})`);
    }
};

export const createRecord = async (
    dbId: number,
    tableName: string,
    data: Record<string, any>
): Promise<any> => {
    if (!dbId || !tableName) throw new Error("DB ID and Table name are required for creating a record.");
    try {
        const encodedTableName = encodeURIComponent(tableName.trim());
        console.log(`API: Creating record in table "${tableName}" (DB ${dbId})...`, data);
        // Clean data (remove undefined) - good practice from Commit 1
        const cleanData = Object.entries(data).reduce((acc, [key, value]) => {
            if (value !== undefined) acc[key] = value;
            return acc;
        }, {} as Record<string, any>);

        // Use endpoint from Commit 2
        const res = await apiClient.post<any>(`/data/${dbId}/tables/${encodedTableName}`, cleanData);
        console.log(`API: Record created in "${tableName}" (DB ${dbId}) successfully.`);
        // Consider adding Number() conversion if PK is returned and might be string
        return res.data;
    } catch (err) {
        throw handleApiError(err as AxiosError | Error, `createRecord(DB ID: ${dbId}, Table: ${tableName})`);
    }
};


export const updateRecord = async (
    dbId: number,
    tableName: string,
    pkValue: string | number,
    data: Record<string, any>
): Promise<any> => {
    if (!dbId || !tableName || pkValue === undefined || pkValue === null) {
        throw new Error("DB ID, Table name and primary key value are required for updating a record.");
    }
    try {
        const encodedTableName = encodeURIComponent(tableName.trim());
        const encodedPk = encodeURIComponent(String(pkValue));
        console.log(`API: Updating record in table "${tableName}" (DB: ${dbId}, PK: ${pkValue})...`, data);
        // Clean data (remove undefined) - good practice from Commit 1
        const cleanData = Object.entries(data).reduce((acc, [key, value]) => {
            if (value !== undefined) acc[key] = value;
            return acc;
        }, {} as Record<string, any>);

        // Use endpoint from Commit 2
        const res = await apiClient.put<any>(`/data/${dbId}/tables/${encodedTableName}/${encodedPk}`, cleanData);
        console.log(`API: Record updated in "${tableName}" (DB: ${dbId}, PK: ${pkValue}) successfully.`);
        // Consider adding Number() conversion if PK is returned and might be string
        return res.data;
    } catch (err) {
        throw handleApiError(err as AxiosError | Error, `updateRecord(DB ID: ${dbId}, Table: ${tableName}, PK: ${pkValue})`);
    }
};




export const deleteColumn = async (
  dbId: number,
  tableName: string,
  columnName: string
): Promise<any> => { // Return type matches other functions for consistency
  // 1. Input Validation (matching other functions)
  if (!dbId || !tableName || !columnName) {
      // Throw simple error, handled by caller or global handler eventually
      throw new Error("DB ID, Table name, and Column name are required for deleting a column.");
  }

  try {
      // 2. Encode parameters for URL path
      const encodedTableName = encodeURIComponent(tableName.trim());
      const encodedColumnName = encodeURIComponent(columnName.trim()); // Encode column name too

      // 3. Log the attempt
      console.log(`API: Deleting column "${columnName}" from table "${tableName}" (DB ${dbId})...`);
      // 4. Construct the URL based on backend routes
      const url = `/meta/databases/${dbId}/tables/${encodedTableName}/columns/${encodedColumnName}`;

      // 5. Make the DELETE request using apiClient
      // DELETE requests typically don't have a request body
      const res = await apiClient.delete<any>(url); // Use DELETE method

      // 6. Log success
      console.log(`API: Column "${columnName}" deleted from "${tableName}" (DB ${dbId}) successfully.`);

      // 7. Return backend response (might be { message: ... } or empty for 204)
      return res.data;

  } catch (err) {
      // 8. Handle errors using the shared handler
      throw handleApiError(
          err as AxiosError | Error,
          `deleteColumn(DB ID: ${dbId}, Table: ${tableName}, Column: ${columnName})` // Context string
      );
  }
};


export const deleteRecord = async (
    dbId: number,
    tableName: string,
    pkValue: string | number
): Promise<void> => {
   if (!dbId || !tableName || pkValue === undefined || pkValue === null) {
       throw new Error("DB ID, Table name and primary key value are required for deleting a record.");
   }
   try {
       const encodedTableName = encodeURIComponent(tableName.trim());
       const encodedPk = encodeURIComponent(String(pkValue));
       console.log(`API: Deleting record from table "${tableName}" (DB: ${dbId}, PK: ${pkValue})...`);
       // Use endpoint from Commit 2
       await apiClient.delete(`/data/${dbId}/tables/${encodedTableName}/${encodedPk}`);
       console.log(`API: Record deleted from "${tableName}" (DB: ${dbId}, PK: ${pkValue}) successfully.`);
   } catch (err) {
       throw handleApiError(err as AxiosError | Error, `deleteRecord(DB ID: ${dbId}, Table: ${tableName}, PK: ${pkValue})`);
   }
};


// --- File Upload --- (Adding from Commit 1 and adapting for dbId)

export const uploadData = async (
    dbId: number, // <-- Add dbId parameter
    tableName: string,
    formData: FormData, // Expect FormData containing the file
    onUploadProgress?: (progressEvent: AxiosProgressEvent) => void // Optional progress callback
): Promise<any> => { // Backend response might vary, use 'any' or a specific type
    if (!dbId) {
         throw new Error("Database ID is required for uploading data.");
    }
    if (!tableName) {
        throw new Error("Table name is required for uploading data.");
    }
    const file = formData.get('file');
    if (!file || !(file instanceof File)) {
      throw new Error("FormData must contain a valid 'file' entry.");
  }

    try {
        const encodedTableName = encodeURIComponent(tableName.trim());
        console.log(`API: Uploading data for table "${tableName}" in DB ID ${dbId}...`);

        // *** IMPORTANT: Use the correct endpoint with dbId ***   
        console.log(formData);   
        const response = await apiClient.post<any>(
            `/data/${dbId}/tables/${encodedTableName}/upload`, // Match potential backend route structure
            formData,
                            // Pass FormData directly
            {
                // withCredentials is now default for apiClient from Commit 2's setup
                onUploadProgress: onUploadProgress // Pass the progress callback to Axios
                // No need to explicitly set Content-Type header here, Axios handles it for FormData
            }
        );

        console.log(`API: Data upload for "${tableName}" (DB ${dbId}) successful.`);
        return response.data; // Return the response data from the backend

    } catch (err) {
        // Use existing error handler
        throw handleApiError(err as AxiosError | Error, `uploadData(DB ID: ${dbId}, Table: ${tableName})`);
    }
};
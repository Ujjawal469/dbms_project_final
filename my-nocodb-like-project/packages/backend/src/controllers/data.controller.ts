import { Request, Response } from 'express';
import * as dataService from '../services/data.service';
import { convertBigIntsToStrings } from '../utils/jsonUtils';
interface FilterCondition {
    id?: number;
    column?: string;
    operator?: string;
    value?: any;
    logicalOperator?: 'AND' | 'OR';
}


export const getTableData = async (req: Request, res: Response) => {
    try {
        const userId = req.session?.userId;

        if (!userId) {
             return res.status(401).json({ message: 'Unauthorized. Please log in.' });
        }
        const { tableName } = req.params;
        const reqLimit = parseInt(req.query.limit as string || '20', 10);
        const reqPage = parseInt(req.query.page as string || '1', 10);
        const limit = Math.min(Math.max(1, isNaN(reqLimit) ? 20 : reqLimit), 100);
        const page = Math.max(1, isNaN(reqPage) ? 1 : reqPage);
        const offset = (page - 1) * limit;

        // --- Filters ---
        let filters: FilterCondition[] | undefined = undefined;
        const filtersQueryParam = req.query.filters as string;
        if (filtersQueryParam) {
            try {
                filters = JSON.parse(filtersQueryParam);
                if (!Array.isArray(filters)) {
                    console.warn("Parsed filters is not an array, ignoring.", filters);
                    filters = undefined;
                } else {
                    console.log("Received and parsed filters:", filters);
                }
            } catch (parseError) {
                console.error("Error parsing filters query parameter:", parseError);
                filters = undefined;
            }
        }

        // --- Table Name Validation ---
        if (!tableName) {
            return res.status(400).json({ message: 'Table name parameter is required.' });
        }
        // Append userId (ensure this naming convention is consistent)
        const finalTableName = tableName + "_" + userId;

        // --- Call Service ---
        const result = await dataService.getData(finalTableName, { limit, offset, filters });

        // --- Response ---
        const finalResponseData = convertBigIntsToStrings(result);
        res.status(200).json(finalResponseData); // Send { data: [...], total: ... }

    } catch (error: any) {
        console.error('Error in getTableData controller:', error);
        // Provide more context in the error response if possible
        res.status(500).json({ message: error.message || 'Internal server error while fetching table data.' });
    }
};

// --- Other controller functions (addRow, updateExistingRow, deleteExistingRow) remain unchanged ---

export const addRow = async (req: Request, res: Response) => {
    try {
        const userId = req.session?.userId;

        if (!userId) {
             return res.status(401).json({ message: 'Unauthorized. Please log in.' });
        }
        const { tableName } = req.params;
        const rowData = req.body;

        if (!tableName || !rowData || typeof rowData !== 'object') {
            return res.status(400).json({ message: 'Invalid request: Missing table name or row data.' });
        }
        const finalTableName = tableName + "_" + userId;
        const newRow = await dataService.createRow(finalTableName, rowData);
        const final = convertBigIntsToStrings(newRow);
        res.status(201).json(final);
    } catch (error: any) {
        console.error('Error adding row:', error);
        // Send back specific constraint violation errors if possible
        res.status(500).json({ message: error.message || 'Internal server error while adding row.' });
    }
};

export const updateExistingRow = async (req: Request, res: Response) => {
    try {
        const userId = req.session?.userId;

        if (!userId) {
             return res.status(401).json({ message: 'Unauthorized. Please log in.' });
        }
        const { tableName, pkValue } = req.params;
        const rowData = req.body;

        if (!tableName || !pkValue || !rowData || typeof rowData !== 'object' || Object.keys(rowData).length === 0) {
            return res.status(400).json({ message: 'Invalid request: Missing table name, primary key value, or update data.' });
        }
        const finalTableName = tableName + "_" + userId;
        const pkColumn = await dataService.getPrimaryKeyColumn(finalTableName);
        if (!pkColumn) {
            // This might indicate the table doesn't exist or has no PK
            return res.status(404).json({ message: `Cannot determine primary key for table "${finalTableName}". Table might not exist or lacks a primary key.` });
        }

        const updatedRow = await dataService.updateRow(finalTableName, pkValue, pkColumn, rowData);
        const final = convertBigIntsToStrings(updatedRow);
        res.status(200).json(final);
    } catch (error: any) {
        console.error('Error updating row:', error);
         // Check if the error message indicates "not found" from the service layer
        if (error.message?.includes('not found')) {
             return res.status(404).json({ message: error.message });
        }
        res.status(500).json({ message: error.message || 'Internal server error while updating row.' });
    }
};

export const deleteExistingRow = async (req: Request, res: Response) => {
    try {
        const userId = req.session?.userId;

        if (!userId) {
             return res.status(401).json({ message: 'Unauthorized. Please log in.' });
        }
        const { tableName, pkValue } = req.params;

        if (!tableName || !pkValue) {
            return res.status(400).json({ message: 'Invalid request: Missing table name or primary key value.' });
        }
        const finalTableName = tableName + "_" + userId;
        const pkColumn = await dataService.getPrimaryKeyColumn(finalTableName);
        if (!pkColumn) {
             return res.status(404).json({ message: `Cannot determine primary key for table "${finalTableName}". Table might not exist or lacks a primary key.` });
        }

        const result = await dataService.deleteRow(finalTableName, pkValue, pkColumn);

        if (result.deleted) {
            res.status(204).send(); // Standard success response for DELETE with no content
        } else {
            // If the service indicates 0 rows affected, it means the row wasn't found
            res.status(404).json({ message: 'Row not found for deletion.' });
        }
    } catch (error: any) {
        console.error('Error deleting row:', error);
         // Handle specific errors like FK constraints if needed
        if (error.message?.includes('foreign key constraint')) {
             return res.status(409).json({ message: 'Cannot delete row because it is referenced by other records.' }); // 409 Conflict
        }
        res.status(500).json({ message: error.message || 'Internal server error while deleting row.' });
    }
};


export const uploadTableData = async (req: Request, res: Response) => {
    try {
        const userId = req.session?.userId;
        if (!userId) {
             return res.status(401).json({ message: 'Unauthorized. Please log in.' });
        }
        const { tableName } = req.params;
        const file = req.file;
        console.log(`file obtained: ${file}`);

        if (!tableName) {
            return res.status(400).json({ message: 'Table name parameter is required.' });
        }
        if (!file) {
            return res.status(400).json({ message: 'No file uploaded or file rejected by filter.' });
        }
        const finalTableName = tableName + "_" + userId;
        console.log(`Upload request received for table: ${finalTableName}, file: ${file.originalname}, size: ${file.size}`);
        const result = await dataService.processCsvUpload(finalTableName, file.buffer);
        res.status(result.tableCreated ? 201 : 200).json(result);

    } catch (error: any) {
        console.error(`Error processing upload for table ${req.params.tableName}:`, error);
        res.status(error.message?.includes("Schema mismatch") || error.message?.includes("Invalid file type") || error.message?.includes("CSV headers") ? 400 : 500)
           .json({ message: error.message || 'Internal server error during file upload processing.' });
    }
};
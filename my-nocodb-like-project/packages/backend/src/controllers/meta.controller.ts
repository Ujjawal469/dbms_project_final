// src/controllers/meta.controller.ts

import { Request, Response } from 'express';
import * as metaService from '../services/meta.service'; // Ensure path is correct

// --- Existing Controller Functions ---

export const addTable = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.session?.userId;
        const { tableName } = req.body; // Get table name from request body

        // 1. Check Authentication
        if (!userId) {
            console.warn('Attempt to add table without authentication.');
            return res.status(401).json({ message: 'Unauthorized. Please log in.' });
        }

        // 2. Basic Input Validation (Service layer does stricter validation)
        if (!tableName || typeof tableName !== 'string' || tableName.trim().length === 0) {
            return res.status(400).json({ message: 'Table name is required in the request body.' });
        }

        const trimmedTableName = tableName.trim();
        console.log(`CONTROLLER: Attempting to CREATE table "${trimmedTableName}" for User ${userId}`);

        // 3. Call the service function to create the table AND associate it
        await metaService.createAndAssociateTable(userId, trimmedTableName);

        console.log(`CONTROLLER: Table "${trimmedTableName}" created and associated successfully for User ${userId}`);

        // 4. Send Success Response
        res.status(201).json({
            message: `Table "${trimmedTableName}" created successfully with a 'serial_num' primary key and associated with your user.`,
            tableName: trimmedTableName
        });

    } catch (error: any) {
        console.error(`CONTROLLER ERROR (addTable - Create):`, error);
        // Pass error to the global error handler which will set appropriate status code
        next(error);
    }
};

export const listTables = async (req: Request, res: Response) => {
    try {
        const userId = req.session?.userId;

        if (!userId) {
            // If userId is not found in the session, the user is not logged in
            console.warn('Attempt to list tables without authentication.');
            return res.status(401).json({ message: 'Unauthorized. Please log in.' });
        }
        // --- End Retrieve userId ---

        // Call the service function with the logged-in user's ID
        const tables = await metaService.getTables(userId);
        res.status(200).json(tables);
    } catch (error: any) {
        console.error('Error listing tables:', error);
        // Send specific error message if available
        res.status(500).json({ message: error.message || 'Failed to list tables' });
    }
};

export const getSchemaForTable = async (req: Request, res: Response) => {
    try {
        const userId = req.session?.userId; // Get userId for potential validation

        if (!userId) {
             return res.status(401).json({ message: 'Unauthorized. Please log in.' });
        }
        const { tableName } = req.params;

        if (!tableName) {
            return res.status(400).json({ message: 'Table name parameter is required.' });
        }
        console.log(`CONTROLLER: Getting schema for ${tableName}`); // Added log
        const schema = await metaService.getTableSchema(tableName);
        res.status(200).json(schema);
    } catch (error: any) {
        console.error(`CONTROLLER Error fetching schema for ${req.params.tableName}:`, error);
        // Check for specific error types if needed (e.g., invalid name from service)
        let statusCode = 500;
        if (error.message.toLowerCase().includes('invalid table name')) {
             statusCode = 400;
        } else if (error.message.toLowerCase().includes('could not fetch schema')) {
            // Maybe the table doesn't exist? Could be 404 or keep 500
             statusCode = 404; // Or 500 if it's an unexpected DB error
        }
        res.status(statusCode).json({ message: error.message || `Failed to get schema for table "${req.params.tableName}".` });
    }
};


// --- NEW CONTROLLER FUNCTION for Adding a Column ---

export const addColumnToTable = async (req: Request, res: Response) => {
    try {
        const userId = req.session?.userId; // Get userId for validation

        if (!userId) {
             return res.status(401).json({ message: 'Unauthorized. Please log in.' });
        }
        const { tableName } = req.params;
        const columnData = req.body; // Request body contains { name: '...', type: '...' }

        // --- Basic Input Validation ---
        if (!tableName) {
            return res.status(400).json({ message: 'Table name parameter is required.' });
        }
        if (!columnData || typeof columnData !== 'object' || !columnData.name || !columnData.type) {
            return res.status(400).json({ message: 'Invalid request body. Column name and type are required.' });
        }
        // --- End Validation ---

        console.log(`CONTROLLER: Attempting to add column to ${tableName}`, columnData);
        // Call the service function (which contains more detailed validation)
        await metaService.addColumn(tableName, columnData);
        console.log(`CONTROLLER: Column added successfully via service for ${tableName}`);

        // Send success response
        res.status(201).json({ message: `Column "${columnData.name}" added successfully to table "${tableName}".` });

    } catch (error: any) {
        console.error(`CONTROLLER ERROR (addColumnToTable - ${req.params.tableName}):`, error);

        // Determine appropriate status code based on errors likely thrown by the service
        let statusCode = 500; // Default to internal server error
        if (error.message.toLowerCase().includes('invalid table name') ||
            error.message.toLowerCase().includes('invalid column name') ||
            error.message.toLowerCase().includes('invalid request body') ||
            error.message.toLowerCase().includes('unsupported or invalid column type')) {
            statusCode = 400; // Bad Request for validation errors
        } else if (error.message.toLowerCase().includes('already exists')) { // Example specific error check
            statusCode = 409; // Conflict - Column might already exist
        } else if (error.message.toLowerCase().includes('could not add column')) {
            // This might indicate a DB-level issue caught by the service
            statusCode = 500;
        }

        res.status(statusCode).json({ message: error.message || 'Failed to add column.' });
    }
};

//-------------delete table -------------------

export const deleteTable = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.session?.userId;
        const { tableName } = req.params; // Get table name from URL parameter

        // 1. Check Authentication
        if (!userId) {
            console.warn('Attempt to delete table without authentication.');
            return res.status(401).json({ message: 'Unauthorized. Please log in.' });
        }

        // 2. Basic Input Validation (Service layer does stricter validation)
        if (!tableName || typeof tableName !== 'string' || tableName.trim().length === 0) {
            return res.status(400).json({ message: 'Table name parameter is required.' });
        }

        const trimmedTableName = tableName.trim();
        console.log(`CONTROLLER: Attempting to DELETE table "${trimmedTableName}" for User ${userId}`);

        // 3. Call the service function to delete the table AND association
        await metaService.deleteTableAndAssociation(userId, trimmedTableName);

        console.log(`CONTROLLER: Table "${trimmedTableName}" deleted successfully for User ${userId}`);

        // 4. Send Success Response (204 No Content is suitable for DELETE)
        res.status(204).send(); // No content to send back on successful delete

    } catch (error: any) {
        console.error(`CONTROLLER ERROR (deleteTable):`, error);
        // Pass error to the global error handler
        next(error);
    }
};

// --- Add other controller functions here later (e.g., updateColumn, deleteColumn) ---
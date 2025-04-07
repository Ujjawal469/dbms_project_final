// src/controllers/meta.controller.ts

import { Request, Response } from 'express';
import * as metaService from '../services/meta.service'; // Ensure path is correct

// --- Existing Controller Functions ---

export const listTables = async (req: Request, res: Response) => {
    try {
        const tables = await metaService.getTables();
        res.status(200).json(tables);
    } catch (error: any) {
        console.error('Error listing tables:', error);
        // Send specific error message if available
        res.status(500).json({ message: error.message || 'Failed to list tables' });
    }
};

export const getSchemaForTable = async (req: Request, res: Response) => {
    try {
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

// --- Add other controller functions here later (e.g., updateColumn, deleteColumn) ---
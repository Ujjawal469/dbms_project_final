// src/controllers/meta.controller.ts

import { Request, Response } from 'express';
import * as metaService from '../services/meta.service';


export const addTable = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.session?.userId;
        const { tableName } = req.body;
        if (!userId) {
            console.warn('Attempt to add table without authentication.');
            return res.status(401).json({ message: 'Unauthorized. Please log in.' });
        }

        if (!tableName || typeof tableName !== 'string' || tableName.trim().length === 0) {
            return res.status(400).json({ message: 'Table name is required in the request body.' });
        }

        const trimmedTableName = tableName.trim();
        const finalTableName = trimmedTableName + "_" + userId;
        console.log(`CONTROLLER: Attempting to CREATE table "${finalTableName}" for User ${userId}`);

        await metaService.createAndAssociateTable(userId, finalTableName);

        console.log(`CONTROLLER: Table "${finalTableName}" created and associated successfully for User ${userId}`);

        res.status(201).json({
            message: `Table "${trimmedTableName}" created successfully.`,
            tableName: finalTableName
        });

    } catch (error: any) {
        console.error(`CONTROLLER ERROR (addTable - Create):`, error);
        next(error);
    }
};

export const listTables = async (req: Request, res: Response) => {
    try {
        const userId = req.session?.userId;

        if (!userId) {
            console.warn('Attempt to list tables without authentication.');
            return res.status(401).json({ message: 'Unauthorized. Please log in.' });
        }

        const tables = await metaService.getTables(userId);
        const trimmedTables = tables.map(name => name.includes('_') ? name.slice(0, name.lastIndexOf('_')) : name);
        res.status(200).json(trimmedTables);
    } catch (error: any) {
        console.error('Error listing tables:', error);
        res.status(500).json({ message: error.message || 'Failed to list tables' });
    }
};

export const getSchemaForTable = async (req: Request, res: Response) => {
    try {
        const userId = req.session?.userId;
        if (!userId) {
             return res.status(401).json({ message: 'Unauthorized. Please log in.' });
        }
        const { tableName } = req.params;

        if (!tableName) {
            return res.status(400).json({ message: 'Table name parameter is required.' });
        }
        const finalTableName = tableName + "_" + userId;
        console.log(`CONTROLLER: Getting schema for ${finalTableName}`);
        const schema = await metaService.getTableSchema(finalTableName);
        res.status(200).json(schema);
    } catch (error: any) {
        console.error(`CONTROLLER Error fetching schema for ${req.params.final}:`, error);
        let statusCode = 500;
        if (error.message.toLowerCase().includes('invalid table name')) {
             statusCode = 400;
        } else if (error.message.toLowerCase().includes('could not fetch schema')) {
             statusCode = 404;
        }
        res.status(statusCode).json({ message: error.message || `Failed to get schema for table "${req.params.tableName}".` });
    }
};


// ---- Adding a Column ---

export const addColumnToTable = async (req: Request, res: Response) => {
    try {
        const userId = req.session?.userId;
        if (!userId) {
             return res.status(401).json({ message: 'Unauthorized. Please log in.' });
        }
        const { tableName } = req.params;
        const columnData = req.body; // Request body contains { name: '...', type: '...' }

        if (!tableName) {
            return res.status(400).json({ message: 'Table name parameter is required.' });
        }
        if (!columnData || typeof columnData !== 'object' || !columnData.name || !columnData.type) {
            return res.status(400).json({ message: 'Invalid request body. Column name and type are required.' });
        }
        const finalTableName = tableName + "_" + userId;
        console.log(`CONTROLLER: Attempting to add column to ${finalTableName}`, columnData);
        await metaService.addColumn(finalTableName, columnData);
        console.log(`CONTROLLER: Column added successfully via service for ${finalTableName}`);
        res.status(201).json({ message: `Column "${columnData.name}" added successfully to table "${finalTableName}".` });

    } catch (error: any) {
        console.error(`CONTROLLER ERROR (addColumnToTable - ${req.params.tableName}):`, error);

        let statusCode = 500;
        if (error.message.toLowerCase().includes('invalid table name') ||
            error.message.toLowerCase().includes('invalid column name') ||
            error.message.toLowerCase().includes('invalid request body') ||
            error.message.toLowerCase().includes('unsupported or invalid column type')) {
            statusCode = 400;
        } else if (error.message.toLowerCase().includes('already exists')) { 
            statusCode = 409; 
        } else if (error.message.toLowerCase().includes('could not add column')) {
            statusCode = 500;
        }

        res.status(statusCode).json({ message: error.message || 'Failed to add column.' });
    }
};

//-------------delete table -------------------

export const deleteTable = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.session?.userId;
        const { tableName } = req.params; 
        if (!userId) {
            console.warn('Attempt to delete table without authentication.');
            return res.status(401).json({ message: 'Unauthorized. Please log in.' });
        }

        if (!tableName || typeof tableName !== 'string' || tableName.trim().length === 0) {
            return res.status(400).json({ message: 'Table name parameter is required.' });
        }

        const trimmedTableName = tableName.trim();
        const finalTableName = tableName + "_" + userId;
        console.log(`CONTROLLER: Attempting to DELETE table "${finalTableName}" for User ${userId}`);

        await metaService.deleteTableAndAssociation(userId, finalTableName);

        console.log(`CONTROLLER: Table "${finalTableName}" deleted successfully for User ${userId}`);

        res.status(204).send(); 
    } catch (error: any) {
        console.error(`CONTROLLER ERROR (deleteTable):`, error);
        next(error);
    }
};


//------------------------- rename table ------------------------------------
export const renameTable = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.session?.userId;
        const { oldTableName } = req.params;   // Get old name from URL parameter
        const { newTableName } = req.body;     // Get new name from request body

        // 1. Check Authentication
        if (!userId) {
            console.warn('Attempt to rename table without authentication.');
            return res.status(401).json({ message: 'Unauthorized. Please log in.' });
        }

        // 2. Basic Input Validation (Service layer does stricter validation)
        if (!oldTableName || typeof oldTableName !== 'string' || oldTableName.trim().length === 0) {
            return res.status(400).json({ message: 'Current table name parameter is required.' });
        }
        if (!newTableName || typeof newTableName !== 'string' || newTableName.trim().length === 0) {
            return res.status(400).json({ message: 'New table name is required in the request body.' });
        }

        const trimmedOldName = oldTableName.trim();
        const trimmedNewName = newTableName.trim();
        const finalOldTableName = trimmedOldName + "_" + userId;
        const finalnewTableName = trimmedNewName + "_" + userId;
        console.log(`CONTROLLER: Attempting to RENAME table "${finalOldTableName}" to "${finalnewTableName}" for User ${userId}`);

        // 3. Call the service function to rename the table AND association
        await metaService.renameTableAndAssociation(userId, finalOldTableName, finalnewTableName);

        console.log(`CONTROLLER: Table "${finalOldTableName}" renamed to "${finalnewTableName}" successfully for User ${userId}`);

        // 4. Send Success Response (200 OK with new name, or 204 No Content)
        res.status(200).json({
            message: `Table "${trimmedOldName}" renamed to "${trimmedNewName}" successfully.`,
            oldTableName: trimmedOldName,
            newTableName: trimmedNewName
        });

    } catch (error: any) {
        console.error(`CONTROLLER ERROR (renameTable):`, error);
        // Pass error to the global error handler
        next(error);
    }
};
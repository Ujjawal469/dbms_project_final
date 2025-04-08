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
        console.log(`CONTROLLER: Attempting to CREATE table "${trimmedTableName}" for User ${userId}`);

        await metaService.createAndAssociateTable(userId, trimmedTableName);

        console.log(`CONTROLLER: Table "${trimmedTableName}" created and associated successfully for User ${userId}`);

        res.status(201).json({
            message: `Table "${trimmedTableName}" created successfully with a 'serial_num' primary key and associated with your user.`,
            tableName: trimmedTableName
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
        res.status(200).json(tables);
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
        console.log(`CONTROLLER: Getting schema for ${tableName}`);
        const schema = await metaService.getTableSchema(tableName);
        res.status(200).json(schema);
    } catch (error: any) {
        console.error(`CONTROLLER Error fetching schema for ${req.params.tableName}:`, error);
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

        console.log(`CONTROLLER: Attempting to add column to ${tableName}`, columnData);
        await metaService.addColumn(tableName, columnData);
        console.log(`CONTROLLER: Column added successfully via service for ${tableName}`);
        res.status(201).json({ message: `Column "${columnData.name}" added successfully to table "${tableName}".` });

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
        console.log(`CONTROLLER: Attempting to DELETE table "${trimmedTableName}" for User ${userId}`);

        await metaService.deleteTableAndAssociation(userId, trimmedTableName);

        console.log(`CONTROLLER: Table "${trimmedTableName}" deleted successfully for User ${userId}`);

        res.status(204).send(); 
    } catch (error: any) {
        console.error(`CONTROLLER ERROR (deleteTable):`, error);
        next(error);
    }
};

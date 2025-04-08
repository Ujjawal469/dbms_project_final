import { Request, Response } from 'express';
import * as dataService from '../services/data.service';
import { convertBigIntsToStrings } from '../utils/jsonUtils';

export const getTableData = async (req: Request, res: Response) => {
    try {
        const userId = req.session?.userId;

        if (!userId) {
             return res.status(401).json({ message: 'Unauthorized. Please log in.' });
        }
        const { tableName } = req.params;
        const page = parseInt(req.query.page as string || '1', 10) || 1;
        const pageSize = parseInt(req.query.pageSize as string || '20', 10) || 20;
        const limit = Math.min(Math.max(1, pageSize), 100);
        const offset = (page - 1) * limit;

        if (!tableName) {
            return res.status(400).json({ message: 'Table name parameter is required.' });
        }

        const result = await dataService.getData(tableName, { limit, offset });
        const final = convertBigIntsToStrings(result);
        res.status(200).json(final); // Expects { data: [...], total: ... }
    } catch (error: any) {
        console.error('Error fetching table data:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

export const addRow = async (req: Request, res: Response) => {
    try {
        const userId = req.session?.userId;

        if (!userId) {
             return res.status(401).json({ message: 'Unauthorized. Please log in.' });
        }
        const { tableName } = req.params;
        const rowData = req.body;

        if (!tableName || !rowData || typeof rowData !== 'object') {
            return res.status(400).json({ message: 'Invalid request.' });
        }

        const newRow = await dataService.createRow(tableName, rowData);
        const final = convertBigIntsToStrings(newRow);
        res.status(201).json(final);
    } catch (error: any) {
        console.error('Error adding row:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
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

        if (!tableName || !pkValue || !rowData || typeof rowData !== 'object') {
            return res.status(400).json({ message: 'Invalid request.' });
        }

        const pkColumn = await dataService.getPrimaryKeyColumn(tableName);
        if (!pkColumn) {
            return res.status(400).json({ message: `Cannot determine primary key for table "${tableName}".` });
        }

        const updatedRow = await dataService.updateRow(tableName, pkValue, pkColumn, rowData);
        const final = convertBigIntsToStrings(updatedRow);
        res.status(200).json(final);
    } catch (error: any) {
        console.error('Error updating row:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
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
            return res.status(400).json({ message: 'Invalid request.' });
        }

        const pkColumn = await dataService.getPrimaryKeyColumn(tableName);
        if (!pkColumn) {
            return res.status(400).json({ message: `Cannot determine primary key for table "${tableName}".` });
        }

        const result = await dataService.deleteRow(tableName, pkValue, pkColumn);

        if (result.deleted) {
            res.status(204).send();
        } else {
            res.status(404).json({ message: 'Row not found for deletion.' });
        }
    } catch (error: any) {
        console.error('Error deleting row:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

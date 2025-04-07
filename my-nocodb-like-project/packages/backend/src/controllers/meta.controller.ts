import { Request, Response } from 'express';
import * as metaService from '../services/meta.service';

export const listTables = async (req: Request, res: Response) => {
    try {
        const tables = await metaService.getTables();
        res.status(200).json(tables);
    } catch (error: any) {
        console.error('Error listing tables:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

export const getSchemaForTable = async (req: Request, res: Response) => {
    try {
        const { tableName } = req.params;

        if (!tableName) {
            return res.status(400).json({ message: 'Table name parameter is required.' });
        }

        const schema = await metaService.getTableSchema(tableName);
        res.status(200).json(schema);
    } catch (error: any) {
        console.error('Error fetching schema:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

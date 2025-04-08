import express from 'express';
import * as metaController from '../controllers/meta.controller'; // Assuming controller functions are here

const router = express.Router();

// Existing routes
router.get('/tables', metaController.listTables);
router.post('/tables', metaController.addTable);
router.get('/tables/:tableName/schema', metaController.getSchemaForTable);

// --- NEW ROUTE for Adding a Column ---
router.post('/tables/:tableName/columns', metaController.addColumnToTable);
// --- END NEW ROUTE ---

export default router;
import express from 'express';
import * as metaController from '../controllers/meta.controller'; // Assuming controller functions are here

const router = express.Router();

// Existing routes
router.get('/tables', metaController.listTables);
router.get('/tables/:tableName/schema', metaController.getSchemaForTable);

// --- NEW ROUTE for Adding a Column ---
router.post('/tables/:tableName/columns', metaController.addColumnToTable); // Add this line
// --- END NEW ROUTE ---

export default router;
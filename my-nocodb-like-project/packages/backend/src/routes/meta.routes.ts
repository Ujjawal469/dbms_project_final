import express from 'express';
import * as metaController from '../controllers/meta.controller'; // Assuming controller functions are here

const router = express.Router();

router.get('/tables', metaController.listTables);
router.post('/tables', metaController.addTable);
router.get('/tables/:tableName/schema', metaController.getSchemaForTable);
router.post('/tables/:tableName/columns', metaController.addColumnToTable);
router.delete('/tables/:tableName', metaController.deleteTable);

export default router;
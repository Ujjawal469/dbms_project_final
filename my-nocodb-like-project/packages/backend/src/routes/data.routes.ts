import express from 'express';
import * as dataController from '../controllers/data.controller';

const router = express.Router();

router.get('/tables/:tableName', dataController.getTableData);
router.post('/tables/:tableName', dataController.addRow);
router.put('/tables/:tableName/:pkValue', dataController.updateExistingRow);
router.delete('/tables/:tableName/:pkValue', dataController.deleteExistingRow);

export default router;
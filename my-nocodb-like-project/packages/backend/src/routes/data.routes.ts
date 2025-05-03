import express from 'express';
import * as dataController from '../controllers/data.controller';
import upload from '../middleware/multer';

const router = express.Router();

router.get('/tables/:tableName', dataController.getTableData);
router.post('/tables/:tableName', dataController.addRow);
router.put('/tables/:tableName/:pkValue', dataController.updateExistingRow);
router.delete('/tables/:tableName/:pkValue', dataController.deleteExistingRow);
router.post(
    '/tables/:tableName/upload',
    upload.single('file'), // Multer middleware to handle single file upload with field name 'file'
    dataController.uploadTableData // Your new controller function
)

export default router;
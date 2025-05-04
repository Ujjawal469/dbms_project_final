import express from 'express';
import * as dataController from '../controllers/data.controller';
import upload from '../middleware/multer';

const router = express.Router();

router.get('/:dbId/tables/:tableName', dataController.getTableData);
router.post('/:dbId/tables/:tableName', dataController.addRow);
router.put('/:dbId/tables/:tableName/:pkValue', dataController.updateExistingRow);
router.delete('/:dbId/tables/:tableName/:pkValue', dataController.deleteExistingRow);
router.post(
    '/:dbId/tables/:tableName/upload', // <-- Ensure :dbId is here
    (req, res, next) => {
        console.log('Content-Type:', req.headers['content-type']);
        console.log(`>>> Request received - BEFORE MULTER`);
        // Trying to access file data HERE will result in undefined
        console.log(`>>> req.file BEFORE MULTER:`, req.file); // EXPECTED TO BE UNDEFINED
        console.log(`>>> req.body BEFORE MULTER:`, req.body); // EXPECTED TO BE UNDEFINED or {}
        console.log(`>>> Content-Type: ${req.headers['content-type']}`); // Check this!
        next();
    },
    upload.single('file'),
    dataController.uploadTableData
);

export default router;
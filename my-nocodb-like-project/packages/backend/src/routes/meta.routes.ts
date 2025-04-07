import express from 'express';
import * as metaController from '../controllers/meta.controller';

const router = express.Router();

router.get('/tables', metaController.listTables);
router.get('/tables/:tableName/schema', metaController.getSchemaForTable);

export default router;
import express from 'express';
import metaRoutes from './meta.routes';
import dataRoutes from './data.routes';
import userRoutes from './user.routes';

const router = express.Router();

// Mount the specific routers
router.use('/meta', metaRoutes);
router.use('/data', dataRoutes);
router.use('/user', userRoutes);

// Optional: Add a root API endpoint check
router.get('/', (req, res) => {
  res.json({ message: 'API is running' });
});

export default router;
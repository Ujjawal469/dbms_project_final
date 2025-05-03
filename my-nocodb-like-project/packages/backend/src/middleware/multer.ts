// src/middleware/multer.ts
import multer from 'multer';

const storage = multer.memoryStorage();

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (file.mimetype === 'text/csv' || file.originalname.toLowerCase().endsWith('.csv')) {
        cb(null, true); // Accept file
    } else {
        cb(new Error('Invalid file type. Only CSV files are allowed.')); // Reject file
    }
};

const limits = {
    fileSize: 50 * 1024 * 1024,
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: limits,
});

export default upload;
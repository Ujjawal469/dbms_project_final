// src/middleware/multer.ts
import multer from 'multer';

const storage = multer.memoryStorage();

// middleware/multer.ts
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    // *** THIS LOG IS ESSENTIAL NOW ***
    console.log(`[Multer Filter] Processing file: name='${file.originalname}', mimetype='${file.mimetype}'`);
    if (file.mimetype === 'text/csv' || file.originalname.toLowerCase().endsWith('.csv')) {
        console.log(`[Multer Filter] Accepting file.`);
        cb(null, true);
    } else {
        console.log(`[Multer Filter] REJECTING file.`);
        // Change this temporarily to see if rejection prevents req.file
        cb(null, false); // Test this first!
        // cb(new Error('Invalid file type...')); // This throws an error Multer catches
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
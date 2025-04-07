import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import 'express-async-errors'; // Handles async errors in routes automatically

import apiRouter from './routes/index'; // Import the main API router
import { errorHandler } from './middleware/errorHandler';

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// --- Core Middleware ---
// Enable CORS (configure origins appropriately for production)
app.use(cors());
// Parse JSON request bodies
app.use(express.json());
// Parse URL-encoded request bodies
app.use(express.urlencoded({ extended: true }));

// --- Logging Middleware (Basic Example) ---
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// --- API Routes ---
// Mount the main API router under the /api prefix
app.use('/api', apiRouter);

// --- Health Check ---
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'UP' });
});

// --- Not Found Handler (Catch-all for non-API routes) ---
// This should be after API routes but before the error handler
app.use((req, res, next) => {
    // If the request didn't match any API route, send a 404
    if (!req.path.startsWith('/api')) {
        // Optional: Serve static frontend files here if needed for production
        // Or just send 404 for any non-API request
         res.status(404).json({ message: `Resource not found at ${req.originalUrl}` });
    } else {
         // If it started with /api but didn't match, let it fall through
         // or handle specifically if needed
          res.status(404).json({ message: `API endpoint not found: ${req.method} ${req.path}` });
    }

});


// --- Global Error Handler (Must be LAST middleware) ---
app.use(errorHandler);

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
  // Log basic DB connection info if URL is set (mask credentials)
  const dbUrl = process.env.DATABASE_URL;
  const dbInfo = dbUrl ? dbUrl.substring(dbUrl.indexOf('@') + 1) : 'Not Set';
  console.log(`Database URL configured for: ${dbInfo}`);
  console.log('Ensure the database server is running and accessible.');
  console.log('Run `npx prisma db pull` or `npx prisma migrate dev` to sync schema.');
});
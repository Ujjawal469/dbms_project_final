import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { Prisma } from '@prisma/client';

// Optional: Define a custom error interface
interface CustomError extends Error {
  statusCode?: number;
  code?: string;
  meta?: Record<string, any>;
}

// Express error-handling middleware
export const errorHandler: ErrorRequestHandler = (
  err: CustomError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  console.error('--- Error Handler ---');
  console.error(`🕒 Timestamp: ${new Date().toISOString()}`);
  console.error(`📍 Route: ${req.method} ${req.originalUrl}`);
  console.error(`❗ Error Name: ${err.name}`);
  console.error(`❗ Error Message: ${err.message}`);
  console.error(err.stack || 'No stack trace available');
  console.error('--- End Error ---');

  // Correct initialization (was previously `let message = {}` — incorrect!)
  let statusCode: number = err.statusCode || 500;
  let message: string = 'An unexpected internal server error occurred.';

  // === Prisma Errors ===
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': // Unique constraint violation
        statusCode = 409;
        message = `Unique constraint failed on field(s): ${Array.isArray(err.meta?.target) ? err.meta?.target.join(', ') : err.meta?.target}`;
        break;
      case 'P2025': // Record not found
        statusCode = 404;
        message = typeof err.meta?.cause === 'string' ? err.meta.cause : 'Record not found.';
        break;
      case 'P2003': // Foreign key constraint failure
        statusCode = 400;
        message = 'Foreign key constraint violation.';
        break;
      default:
        statusCode = 400;
        message = `Database error: ${err.message}`;
    }
  }

  // === Custom application errors ===
  else if (err.message?.toLowerCase().includes('not found')) {
    statusCode = 404;
    message = err.message;
  } else if (err.message?.toLowerCase().includes('invalid')) {
    statusCode = 400;
    message = err.message;
  }

  // === Send Final Error Response ===
  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

import { NextFunction, Request, Response } from 'express';
import { HttpException } from '../utils/exceptions/HttpException';

/**
 * Error handling middleware
 * Catches all errors thrown in the application and formats them for response
 */
export const errorHandler = (
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  try {
    const status = error instanceof HttpException ? error.status : 500;
    const message = error.message || 'Something went wrong';

    console.error(
      `[${new Date().toISOString()}] [ERROR] [${status}]: ${message}`,
      error instanceof HttpException ? '' : error.stack,
    );

    res.status(status).json({
      status,
      message,
    });
  } catch (err) {
    // If error handling itself fails, send a generic response
    res.status(500).json({
      status: 500,
      message: 'Internal server error',
    });
  }
};

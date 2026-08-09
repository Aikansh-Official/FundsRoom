import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../utils/http-error.js';

export const notFound: RequestHandler = (req, _res, next) => {
  next(new HttpError(404, `Route ${req.method} ${req.originalUrl} was not found.`));
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    return res.status(422).json({ message: 'Validation failed.', errors: error.flatten() });
  }

  if (error instanceof HttpError) {
    return res.status(error.statusCode).json({ message: error.message, details: error.details });
  }

  if (typeof error === 'object' && error && 'code' in error && error.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ message: 'A record with that unique value already exists.' });
  }

  console.error(error);
  return res.status(500).json({ message: 'An unexpected server error occurred.' });
};

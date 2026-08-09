import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { HttpError } from '../utils/http-error.js';

type TokenPayload = NonNullable<Request['user']>;

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const token = req.header('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return next(new HttpError(401, 'Authentication is required.'));

  try {
    req.user = jwt.verify(token, env.jwtSecret) as TokenPayload;
    return next();
  } catch {
    return next(new HttpError(401, 'Your session is invalid or has expired.'));
  }
}

export function requireRoles(...roles: TokenPayload['role'][]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new HttpError(403, 'You do not have permission to perform this action.'));
    }
    return next();
  };
}

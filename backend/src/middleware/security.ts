import rateLimit from 'express-rate-limit';

const tooManyRequests = { message: 'Too many requests. Please try again later.' };

/** A broad guard for the API. Authentication and authorization still run for every request. */
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: tooManyRequests,
});

/** Login is deliberately much stricter to slow password guessing and credential stuffing. */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many sign-in attempts. Please try again later.' },
});

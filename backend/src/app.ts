import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { errorHandler, notFound } from './middleware/error-handler.js';
import { apiRateLimiter } from './middleware/security.js';
import { authRouter } from './routes/auth.routes.js';
import { analyticsRouter } from './routes/analytics.routes.js';
import { challansRouter } from './routes/challans.routes.js';
import { customersRouter } from './routes/customers.routes.js';
import { dashboardRouter } from './routes/dashboard.routes.js';
import { productsRouter } from './routes/products.routes.js';
import { notificationsRouter } from './routes/notifications.routes.js';
import { stockRequestsRouter } from './routes/stock-requests.routes.js';

export const app = express();

app.disable('x-powered-by');
app.set('trust proxy', env.nodeEnv === 'production' ? 1 : false);
app.use(helmet());
app.use(cors({
  origin: env.clientOrigin,
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type'],
}));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));
app.use('/api', apiRateLimiter);
app.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'fundsroom-operations-api' }));
app.use('/api/auth', authRouter);
app.use('/api/customers', customersRouter);
app.use('/api/products', productsRouter);
app.use('/api/challans', challansRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/stock-requests', stockRequestsRouter);

app.use(notFound);
app.use(errorHandler);

export default app;

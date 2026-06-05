import './config/env.js';
import express from 'express';
import router from './routes/index.js';
import adminRouter from './routes/admin/index.js';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import compression from 'compression';
import prettyMilliseconds from 'pretty-ms';
import morganMiddleware from './config/logger.js';
import dns from 'dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);
const app = express();
app.set('trust proxy', 1);
app.use(
  cors({
    origin: [process.env.CLIENT_URL, process.env.ADMIN_URL, 'http://localhost:5174'],
    credentials: true,
  })
);
app.use(compression());
app.use(helmet());
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morganMiddleware);
app.use('/api/v1', router);
app.use('/api/v1/admin', adminRouter);
app.get('/health', (req, res) => {
  return res.status(200).json({
    status: 'UP',
    uptime: prettyMilliseconds(process.uptime() * 1000),
    timestamp: Date.now(),
  });
});
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  return res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    errors: err.errors || null,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});

export default app;

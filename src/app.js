import './config/env.js';
import express from 'express';
import router from './routes/index.js';
import adminRouter from './routes/admin/index.js';
import fileRoute from './routes/file.route.js';
import categoryImagesRoute from './routes/categoryImages.route.js';
import dealSurveyRoute from './routes/dealSurvey.route.js';
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
    origin: (origin, callback) => {
      const allowedOrigins = [
        process.env.CLIENT_URL,
        process.env.ADMIN_URL,
        'http://localhost:5173',
        'http://localhost:5174',
        'https://saralbuy.com',
        'https://www.saralbuy.com',
      ];
      const normalizedOrigin = origin ? origin.replace(/\/$/, '') : '';
      if (
        !origin ||
        allowedOrigins.some(o => o && o.replace(/\/$/, '') === normalizedOrigin) ||
        normalizedOrigin.endsWith('.loca.lt') ||
        normalizedOrigin.endsWith('.ngrok-free.app') ||
        normalizedOrigin.endsWith('.serveousercontent.com') ||
        normalizedOrigin.endsWith('.netlify.app') ||
        normalizedOrigin.includes('netlify.app')
      ) {
        callback(null, true);
      } else {
        console.error('CORS blocked origin:', origin);
        callback(new Error('Not allowed by CORS'));
      }
    },
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
app.use('/api/v1/files', fileRoute);
app.use('/api/v1', categoryImagesRoute);
app.use('/api/v1/deal-survey', dealSurveyRoute);
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

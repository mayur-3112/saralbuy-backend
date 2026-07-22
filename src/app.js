import './config/env.js';
import Sentry from './config/sentry.js';
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
// Explicit allow-list only — no wildcard subdomain matching. The previous
// version accepted ANY *.vercel.app / *.netlify.app / *.ngrok-free.app /
// *.loca.lt origin with credentials:true, meaning anyone could spin up a
// free deployment on one of those platforms and make authenticated,
// cookie-carrying requests to this API. CLIENT_URL/ADMIN_URL cover the
// real deployed frontends; extend EXTRA_ALLOWED_ORIGINS (comma-separated
// env var) for a specific preview URL when one is genuinely needed for
// testing — never re-add a suffix/wildcard match here.
const extraAllowedOrigins = (process.env.EXTRA_ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.ADMIN_URL,
  'http://localhost:5173',
  'http://localhost:5174',
  'https://saralbuy.com',
  'https://www.saralbuy.com',
  ...extraAllowedOrigins,
].filter(Boolean).map(o => o.replace(/\/$/, ''));

app.use(
  cors({
    origin: (origin, callback) => {
      const normalizedOrigin = origin ? origin.replace(/\/$/, '') : '';
      if (!origin || allowedOrigins.includes(normalizedOrigin)) {
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
// Must be registered after all routes and before the final error handler —
// captures any error that reaches this point and forwards it to Sentry
// (no-op if SENTRY_DSN isn't set, see config/sentry.js).
Sentry.setupExpressErrorHandler(app);

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

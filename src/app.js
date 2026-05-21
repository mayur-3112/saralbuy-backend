import './config/env.js';
import express from 'express';
import router from './routes/index.js';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dns from 'dns';
import helmet from 'helmet';
import morganMiddleware from './config/logger.js';
import http from 'node:http';
import compression from 'compression';
import { initSocket } from './config/socket.js';
dns.setServers(['1.1.1.1', '8.8.8.8']);
const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);
initSocket(server);
app.use(
  cors({
    origin: [process.env.CLIENT_URL],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
    exposedHeaders: ['Set-Cookie'],
  })
);
app.use(compression());
app.use(helmet());
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morganMiddleware);
app.use('/api/v1', router);

app.use((err, req, res, next) => {
  const statusCode = 400;
  return res.status(statusCode).json({
    success: false,
    message: err.message || '',
    errors: err.errors || null,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});

app.get('/health', (req, res) => {
  res.end('ok');
});

export default server;

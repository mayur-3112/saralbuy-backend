import { Server } from 'socket.io';
import registerSocketHandlers from '../socket/index.js';
import cookie from 'cookie';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './secrets.js';

let io;
export const initSocket = server => {
  io = new Server(server, {
    cors: {
      origin: [
        process.env.CLIENT_URL,
        process.env.ADMIN_URL,
        'http://localhost:5174',
        'https://saralbuy.com',
        'https://www.saralbuy.com',
      ],
      credentials: true,
      methods: ['GET', 'POST', 'DELETE', 'PUT'],
    },
    transports: ['websocket', 'polling'],
  });

  io.use((socket, next) => {
    const rawCookie = socket.handshake.headers.cookie;
    if (!rawCookie) {
      return next(new Error('No cookies found'));
    }
    const parsedCookies = cookie.parse(rawCookie);
    const token = parsedCookies.authToken;

    if (!token) {
      return next(new Error('Token not found'));
    }
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (err) {
      return next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', socket => {
    const userId = socket.user._id;
    socket.join(userId);
    console.log('User Connected:', userId);
    registerSocketHandlers(io, socket);
    socket.on('disconnect', () => {
      console.log('User Disconnected:', userId);
    });
  });
};

export const getIO = () => {
  if (!io) throw new Error('Socket not initialized');
  return io;
};

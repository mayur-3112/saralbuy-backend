import { Server } from 'socket.io';
import registerSocketHandlers from '../socket/index.js';
import cookie from 'cookie';
import jwt from 'jsonwebtoken';

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
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    socket.user = decoded;
    // console.log({
    //   'Socket Connected: ': socket.id,
    //   'Authenticated User: ': decoded._id,
    // });
    next();
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

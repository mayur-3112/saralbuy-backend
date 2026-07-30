import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import registerSocketHandlers from '../socket/index.js';
import cookie from 'cookie';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './secrets.js';
import {
  addSocket,
  removeSocket,
  touchHeartbeat,
  lastHeartbeat,
  HEARTBEAT_TIMEOUT_MS,
} from '../socket/onlineUsers.js';
import { SOCKET_EVENTS } from '../socket/socketEvents.js';
import userSchema from '../models/user.schema.js';

let io;

// Socket.IO keeps connected-client state in memory per process — with more
// than one backend instance, a chat message from a user on instance A never
// reaches a recipient connected to instance B unless every instance shares
// the same pub/sub bus. This adapter is that shared bus, backed by Redis.
// Only activates when REDIS_URL is set (today: it isn't, and the server
// runs on a single instance — this is prerequisite wiring for when either
// changes, not something needed right now).
async function attachRedisAdapter(io) {
  if (!process.env.REDIS_URL) {
    console.warn(
      '[WARN] REDIS_URL not set — Socket.IO running single-instance only. ' +
        'Required before ever scaling the backend to more than one instance.'
    );
    return;
  }
  try {
    const pubClient = createClient({ url: process.env.REDIS_URL });
    const subClient = pubClient.duplicate();
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    console.log('Socket.IO Redis adapter connected — ready for multi-instance');
  } catch (err) {
    console.error('Socket.IO Redis adapter failed to connect, running single-instance:', err.message);
  }
}

export const initSocket = async server => {
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

  await attachRedisAdapter(io);

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

    // A connected socket IS "online" — no need to wait for the client to
    // separately emit an online-announce event (the old flow relied on
    // that, so a client that connected but never fired it stayed invisible
    // as online to everyone else).
    addSocket(userId, socket.id);
    io.emit(SOCKET_EVENTS.USER_STATUS, { userId: userId.toString(), isOnline: true });

    registerSocketHandlers(io, socket);

    socket.on(SOCKET_EVENTS.HEARTBEAT, () => touchHeartbeat(socket.id));

    socket.on('disconnect', () => {
      console.log('User Disconnected:', userId);
      removeSocket(userId, socket.id, async uid => {
        io.emit(SOCKET_EVENTS.USER_STATUS, { userId: uid, isOnline: false });
        try {
          await userSchema.findByIdAndUpdate(uid, { $set: { lastSeenAt: new Date() } });
        } catch (err) {
          console.error('Failed to persist lastSeenAt:', err.message);
        }
      });
    });
  });

  // Sweep for sockets that stopped heartbeating without ever firing
  // `disconnect` — a backgrounded/frozen tab (laptop sleep, suspended
  // mobile tab) can hold a technically-open socket well past the point a
  // human would call the user "online". Forcibly disconnecting a stale
  // socket routes it through the normal disconnect handler above, so grace
  // window + lastSeenAt persistence stay a single code path.
  setInterval(() => {
    const now = Date.now();
    for (const [socketId, ts] of lastHeartbeat.entries()) {
      if (now - ts > HEARTBEAT_TIMEOUT_MS) {
        const staleSocket = io.sockets.sockets.get(socketId);
        if (staleSocket) staleSocket.disconnect(true);
      }
    }
  }, HEARTBEAT_TIMEOUT_MS / 2);
};

export const getIO = () => {
  if (!io) throw new Error('Socket not initialized');
  return io;
};

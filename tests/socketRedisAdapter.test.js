import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { RedisMemoryServer } from 'redis-memory-server';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { io as ioClient } from 'socket.io-client';

// Proves the actual thing this adapter exists for: a message emitted from
// ONE Socket.IO server instance reaches a client connected to a DIFFERENT
// instance, as long as both share the same Redis pub/sub bus — the exact
// scenario that silently breaks chat delivery the moment the backend scales
// to more than one process. This is a focused test of the adapter mechanism
// itself (a minimal server pair), not the full authenticated app socket
// layer, matching the manual "run 2 local instances" verification described
// for this task.
describe('Socket.IO Redis adapter — cross-instance message delivery', () => {
  let redisServer, redisUrl;
  let httpServerA, httpServerB, ioA, ioB;
  let portA, portB;
  const redisClients = [];

  beforeAll(async () => {
    redisServer = await RedisMemoryServer.create();
    const host = await redisServer.getHost();
    const port = await redisServer.getPort();
    redisUrl = `redis://${host}:${port}`;

    async function makeServer() {
      const httpServer = createServer();
      const io = new Server(httpServer);
      const pubClient = createClient({ url: redisUrl });
      const subClient = pubClient.duplicate();
      await Promise.all([pubClient.connect(), subClient.connect()]);
      redisClients.push(pubClient, subClient);
      io.adapter(createAdapter(pubClient, subClient));
      await new Promise(resolve => httpServer.listen(0, resolve));
      return { httpServer, io, port: httpServer.address().port };
    }

    ({ httpServer: httpServerA, io: ioA, port: portA } = await makeServer());
    ({ httpServer: httpServerB, io: ioB, port: portB } = await makeServer());
  }, 30000);

  afterAll(async () => {
    await new Promise(resolve => ioA?.close(resolve));
    await new Promise(resolve => ioB?.close(resolve));
    await Promise.all(redisClients.map(c => c.quit().catch(() => {})));
    await redisServer?.stop();
  });

  it('delivers a message emitted on instance A to a client connected to instance B', async () => {
    const room = 'test-room';

    ioA.on('connection', socket => socket.join(room));
    ioB.on('connection', socket => socket.join(room));

    const clientOnB = ioClient(`http://localhost:${portB}`, { transports: ['websocket'] });
    await new Promise(resolve => clientOnB.on('connect', resolve));

    const received = new Promise(resolve => {
      clientOnB.on('cross-instance-message', payload => resolve(payload));
    });

    // Give the room-join a moment to register before instance A emits.
    await new Promise(r => setTimeout(r, 200));

    // Emitted from instance A's server — clientOnB is only connected to B.
    ioA.to(room).emit('cross-instance-message', { from: 'instance-A' });

    const payload = await Promise.race([
      received,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timed out waiting for cross-instance delivery')), 5000)),
    ]);

    expect(payload).toEqual({ from: 'instance-A' });
    clientOnB.disconnect();
  }, 10000);
});

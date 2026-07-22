import { MongoMemoryServer } from 'mongodb-memory-server';

// Vitest global setup runs once before the whole suite (in a separate
// process from the tests themselves) — starts a real, isolated, in-memory
// MongoDB so tests never touch the actual Atlas cluster, and exposes its
// URI to test files via an env var.
export default async function setup() {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.__MONGOD_TEARDOWN__ = 'pending';

  return async () => {
    await mongod.stop();
  };
}

import mongoose from 'mongoose';
import { beforeAll, afterAll, afterEach } from 'vitest';

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: 'saralbuy_test' });
});

afterEach(async () => {
  // Isolate tests from each other's data without the overhead of a fresh
  // connection per test.
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map(c => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.connection.close();
});

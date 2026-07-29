import { MongoMemoryReplSet } from 'mongodb-memory-server';

// Vitest global setup runs once before the whole suite (in a separate
// process from the tests themselves) — starts a real, isolated, in-memory
// MongoDB so tests never touch the actual Atlas cluster, and exposes its
// URI to test files via an env var.
//
// A single-instance MongoMemoryServer can't run transactions ("Transaction
// numbers are only allowed on a replica set member or mongos") — several
// real endpoints (createBid, deleteBid, updateQuoteStatus in
// bid.service.js) use mongoose.startSession()/transactions, so any
// HTTP-level test against them needs an actual (if single-node) replica
// set, not a standalone instance.
export default async function setup() {
  const mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = mongod.getUri();
  process.env.__MONGOD_TEARDOWN__ = 'pending';

  return async () => {
    await mongod.stop();
  };
}

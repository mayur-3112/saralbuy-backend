import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import userSchema from '../src/models/user.schema.js';
import productSchema from '../src/models/product.schema.js';
import bidSchema from '../src/models/bid.schema.js';

// M3.T4 (Implementation Master Plan) — proves the quote-status state
// machine actually enforces the transition rules, not just "the file
// compiles". Full HTTP-level test against the real app + in-memory Mongo,
// same pattern as verificationDecision.test.js.

async function makeBuyerAgent() {
  const buyer = await userSchema.create({ phone: `+9198767${Math.floor(Math.random() * 100000)}` });
  const token = buyer.generateAuthToken();
  return { buyer, cookie: `authToken=${token}` };
}

async function makeBidFixture(buyerId) {
  const seller = await userSchema.create({ phone: `+9198768${Math.floor(Math.random() * 100000)}` });
  const product = await productSchema.create({ title: 'Test RFQ', userId: buyerId, draft: false });
  const bid = await bidSchema.create({
    sellerId: seller._id,
    buyerId,
    productId: product._id,
    budgetQuation: 1000,
  });
  return { seller, product, bid };
}

describe('Quote-status state machine', () => {
  let buyer, cookie;
  beforeEach(async () => {
    ({ buyer, cookie } = await makeBuyerAgent());
  });

  it('starts as pending and allows pending -> shortlisted', async () => {
    const { bid } = await makeBidFixture(buyer._id);
    expect(bid.quoteStatus).toBe('pending');

    const res = await request(app)
      .put(`/api/v1/bid/update-quote-status/${bid._id}`)
      .set('Cookie', cookie)
      .send({ quoteStatus: 'shortlisted' });

    expect(res.status).toBe(200);
    const updated = await bidSchema.findById(bid._id);
    expect(updated.quoteStatus).toBe('shortlisted');
  });

  it('allows pending -> accepted directly (skipping shortlisted)', async () => {
    const { bid } = await makeBidFixture(buyer._id);
    const res = await request(app)
      .put(`/api/v1/bid/update-quote-status/${bid._id}`)
      .set('Cookie', cookie)
      .send({ quoteStatus: 'accepted' });
    expect(res.status).toBe(200);
  });

  it('allows shortlisted -> accepted', async () => {
    const { bid } = await makeBidFixture(buyer._id);
    bid.quoteStatus = 'shortlisted';
    await bid.save();

    const res = await request(app)
      .put(`/api/v1/bid/update-quote-status/${bid._id}`)
      .set('Cookie', cookie)
      .send({ quoteStatus: 'accepted' });
    expect(res.status).toBe(200);
  });

  it('rejects accepted -> rejected — accepted is terminal (this was the bug: previously allowed)', async () => {
    const { bid } = await makeBidFixture(buyer._id);
    bid.quoteStatus = 'accepted';
    await bid.save();

    const res = await request(app)
      .put(`/api/v1/bid/update-quote-status/${bid._id}`)
      .set('Cookie', cookie)
      .send({ quoteStatus: 'rejected' });

    expect(res.status).toBe(400);
    const unchanged = await bidSchema.findById(bid._id);
    expect(unchanged.quoteStatus).toBe('accepted');
  });

  it('rejects accepted -> shortlisted — accepted is terminal', async () => {
    const { bid } = await makeBidFixture(buyer._id);
    bid.quoteStatus = 'accepted';
    await bid.save();

    const res = await request(app)
      .put(`/api/v1/bid/update-quote-status/${bid._id}`)
      .set('Cookie', cookie)
      .send({ quoteStatus: 'shortlisted' });

    expect(res.status).toBe(400);
  });

  it('rejects rejected -> shortlisted — rejected is terminal', async () => {
    const { bid } = await makeBidFixture(buyer._id);
    bid.quoteStatus = 'rejected';
    await bid.save();

    const res = await request(app)
      .put(`/api/v1/bid/update-quote-status/${bid._id}`)
      .set('Cookie', cookie)
      .send({ quoteStatus: 'shortlisted' });

    expect(res.status).toBe(400);
  });

  it('rejects a redundant shortlisted -> shortlisted no-op', async () => {
    const { bid } = await makeBidFixture(buyer._id);
    bid.quoteStatus = 'shortlisted';
    await bid.save();

    const res = await request(app)
      .put(`/api/v1/bid/update-quote-status/${bid._id}`)
      .set('Cookie', cookie)
      .send({ quoteStatus: 'shortlisted' });

    expect(res.status).toBe(400);
  });

  it('accepting one bid auto-rejects the other bids on the same product (existing side effect preserved)', async () => {
    const { bid: bidA, product } = await makeBidFixture(buyer._id);
    const sellerB = await userSchema.create({ phone: `+9198769${Math.floor(Math.random() * 100000)}` });
    const bidB = await bidSchema.create({
      sellerId: sellerB._id,
      buyerId: buyer._id,
      productId: product._id,
      budgetQuation: 900,
    });

    const res = await request(app)
      .put(`/api/v1/bid/update-quote-status/${bidA._id}`)
      .set('Cookie', cookie)
      .send({ quoteStatus: 'accepted' });
    expect(res.status).toBe(200);

    const updatedB = await bidSchema.findById(bidB._id);
    expect(updatedB.quoteStatus).toBe('rejected');
  });
});

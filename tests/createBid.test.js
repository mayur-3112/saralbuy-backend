import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import userSchema from '../src/models/user.schema.js';
import productSchema from '../src/models/product.schema.js';
import requirementSchema from '../src/models/requirement.schema.js';
import bidSchema from '../src/models/bid.schema.js';

// Confirms createBid's transaction rewrite (manual startTransaction ->
// session.withTransaction, M3.T4 cleanup) still produces the same
// end-to-end result: a created Bid, an incremented Product.totalBidCount,
// and the seller pushed onto the Requirement.

describe('createBid (session.withTransaction rewrite)', () => {
  it('creates a bid, increments totalBidCount, and updates the requirement', async () => {
    const buyer = await userSchema.create({ phone: `+9198770${Math.floor(Math.random() * 100000)}` });
    const seller = await userSchema.create({ phone: `+9198771${Math.floor(Math.random() * 100000)}` });
    const sellerToken = seller.generateAuthToken();

    const product = await productSchema.create({ title: 'Cement 50kg', userId: buyer._id, draft: false });
    await requirementSchema.create({ productId: product._id, buyerId: buyer._id, sellers: [] });

    const res = await request(app)
      .post(`/api/v1/bid/create/${buyer._id}/${product._id}`)
      .set('Cookie', `authToken=${sellerToken}`)
      .field('budgetQuation', '5000');

    expect(res.status).toBe(200);

    const bid = await bidSchema.findOne({ sellerId: seller._id, productId: product._id });
    expect(bid).not.toBeNull();
    expect(bid.budgetQuation).toBe(5000);

    const updatedProduct = await productSchema.findById(product._id);
    expect(updatedProduct.totalBidCount).toBe(1);

    const requirement = await requirementSchema.findOne({ productId: product._id, buyerId: buyer._id });
    expect(requirement.sellers).toHaveLength(1);
    expect(requirement.sellers[0].sellerId.toString()).toBe(seller._id.toString());
  });

  it('rejects a second bid from the same seller on the same product', async () => {
    const buyer = await userSchema.create({ phone: `+9198772${Math.floor(Math.random() * 100000)}` });
    const seller = await userSchema.create({ phone: `+9198773${Math.floor(Math.random() * 100000)}` });
    const sellerToken = seller.generateAuthToken();

    const product = await productSchema.create({ title: 'Cement 50kg', userId: buyer._id, draft: false });
    await requirementSchema.create({ productId: product._id, buyerId: buyer._id, sellers: [] });

    const first = await request(app)
      .post(`/api/v1/bid/create/${buyer._id}/${product._id}`)
      .set('Cookie', `authToken=${sellerToken}`)
      .field('budgetQuation', '5000');
    expect(first.status).toBe(200);

    const second = await request(app)
      .post(`/api/v1/bid/create/${buyer._id}/${product._id}`)
      .set('Cookie', `authToken=${sellerToken}`)
      .field('budgetQuation', '4800');
    expect(second.status).toBe(400);

    const bids = await bidSchema.find({ sellerId: seller._id, productId: product._id });
    expect(bids).toHaveLength(1);
  });
});

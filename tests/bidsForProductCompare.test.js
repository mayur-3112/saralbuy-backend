import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import userSchema from '../src/models/user.schema.js';
import productSchema from '../src/models/product.schema.js';
import requirementSchema from '../src/models/requirement.schema.js';
import bidSchema from '../src/models/bid.schema.js';

// The buyer's item-by-item comparison grid (RequirementOverview.jsx) needs
// BOTH the requested item list (product.items) and every supplier's bids
// from this one endpoint, so it can render "Requested Item -> Supplier A/B/C"
// rows. The response shape was changed from a bare array to
// { product, bids } to carry both -- this proves the new shape actually
// works end-to-end, not just that it compiles.

describe('GET /bid/compare/:productId', () => {
  it('returns both the requested item list and every bid, with items[] intact', async () => {
    const buyer = await userSchema.create({ phone: `+9198790${Math.floor(Math.random() * 100000)}` });
    const buyerToken = buyer.generateAuthToken();
    const sellerA = await userSchema.create({ phone: `+9198791${Math.floor(Math.random() * 100000)}` });
    const sellerB = await userSchema.create({ phone: `+9198792${Math.floor(Math.random() * 100000)}` });

    const product = await productSchema.create({
      title: 'Multi-material RFQ',
      userId: buyer._id,
      draft: false,
      isMultiple: true,
      items: [{ subCategoryName: 'Cement', quantity: '500', quantityUnit: 'bags' }],
    });
    await requirementSchema.create({ productId: product._id, buyerId: buyer._id, sellers: [] });
    const [cementItem] = (await productSchema.findById(product._id).lean()).items;

    await bidSchema.create({
      sellerId: sellerA._id,
      buyerId: buyer._id,
      productId: product._id,
      budgetQuation: 200000,
      items: [{ productItemId: cementItem._id, offeredBrand: 'UltraTech', unitPrice: 400 }],
    });
    await bidSchema.create({
      sellerId: sellerB._id,
      buyerId: buyer._id,
      productId: product._id,
      budgetQuation: 180000,
      items: [{ productItemId: cementItem._id, offeredBrand: 'ACC', unitPrice: 360 }],
    });

    const res = await request(app)
      .get(`/api/v1/bid/compare/${product._id}`)
      .set('Cookie', `authToken=${buyerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.product._id).toBe(product._id.toString());
    expect(res.body.data.product.items).toHaveLength(1);
    expect(res.body.data.bids).toHaveLength(2);

    const bidA = res.body.data.bids.find(b => b.sellerId._id === sellerA._id.toString());
    expect(bidA.items[0].offeredBrand).toBe('UltraTech');
    expect(bidA.items[0].unitPrice).toBe(400);
  });

  it('rejects a non-buyer trying to compare quotes on someone else\'s requirement', async () => {
    const buyer = await userSchema.create({ phone: `+9198793${Math.floor(Math.random() * 100000)}` });
    const outsider = await userSchema.create({ phone: `+9198794${Math.floor(Math.random() * 100000)}` });
    const outsiderToken = outsider.generateAuthToken();
    const product = await productSchema.create({ title: 'RFQ', userId: buyer._id, draft: false });

    const res = await request(app)
      .get(`/api/v1/bid/compare/${product._id}`)
      .set('Cookie', `authToken=${outsiderToken}`);

    expect(res.status).toBe(403);
  });
});

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import userSchema from '../src/models/user.schema.js';
import productSchema from '../src/models/product.schema.js';
import requirementSchema from '../src/models/requirement.schema.js';
import bidSchema from '../src/models/bid.schema.js';

// Item-level procurement: a supplier quoting on a multi-material RFQ must be
// able to price each material separately, and the server -- not the client
// -- must be the one computing the total from those per-item prices.

async function makeMultiItemRequirement() {
  const buyer = await userSchema.create({ phone: `+9198780${Math.floor(Math.random() * 100000)}` });
  const seller = await userSchema.create({ phone: `+9198781${Math.floor(Math.random() * 100000)}` });
  const sellerToken = seller.generateAuthToken();

  const product = await productSchema.create({
    title: 'Cement + TMT Steel RFQ',
    userId: buyer._id,
    draft: false,
    isMultiple: true,
    items: [
      { subCategoryName: 'Cement', brandName: 'Any', quantity: '500', quantityUnit: 'bags' },
      { subCategoryName: 'TMT Steel', brandName: 'Any', quantity: '2', quantityUnit: 'tons' },
    ],
  });
  await requirementSchema.create({ productId: product._id, buyerId: buyer._id, sellers: [] });

  const savedProduct = await productSchema.findById(product._id).lean();
  return { buyer, seller, sellerToken, product: savedProduct };
}

describe('Item-level quote submission (RFQ item-level procurement)', () => {
  it('accepts a per-item quote and derives budgetQuation server-side from unitPrice x quantity', async () => {
    const { buyer, sellerToken, product } = await makeMultiItemRequirement();
    const [cementItem, steelItem] = product.items;

    const items = [
      { productItemId: cementItem._id.toString(), offeredBrand: 'UltraTech', unitPrice: 400, availability: 'in_stock', remarks: 'Ready to ship' },
      { productItemId: steelItem._id.toString(), offeredBrand: 'JSW Steel', unitPrice: 60000, availability: 'lead_time', remarks: '3 day lead time' },
    ];

    const res = await request(app)
      .post(`/api/v1/bid/create/${buyer._id}/${product._id}`)
      .set('Cookie', `authToken=${sellerToken}`)
      .field('items', JSON.stringify(items));

    expect(res.status).toBe(200);

    // 500 bags * 400 + 2 tons * 60000 = 200000 + 120000 = 320000
    const expectedTotal = 500 * 400 + 2 * 60000;
    const bid = await bidSchema.findOne({ productId: product._id });
    expect(bid.budgetQuation).toBe(expectedTotal);
    expect(bid.items).toHaveLength(2);

    const cementLine = bid.items.find(i => i.productItemId.toString() === cementItem._id.toString());
    expect(cementLine.offeredBrand).toBe('UltraTech');
    expect(cementLine.unitPrice).toBe(400);
    expect(cementLine.availability).toBe('in_stock');

    const steelLine = bid.items.find(i => i.productItemId.toString() === steelItem._id.toString());
    expect(steelLine.offeredBrand).toBe('JSW Steel');
    expect(steelLine.availability).toBe('lead_time');
  });

  it('ignores a client-supplied budgetQuation when items[] is present -- the server total wins', async () => {
    const { buyer, sellerToken, product } = await makeMultiItemRequirement();
    const [cementItem] = product.items;

    const items = [{ productItemId: cementItem._id.toString(), unitPrice: 100 }];

    const res = await request(app)
      .post(`/api/v1/bid/create/${buyer._id}/${product._id}`)
      .set('Cookie', `authToken=${sellerToken}`)
      .field('budgetQuation', '999999') // a client trying to send an arbitrary total
      .field('items', JSON.stringify(items));

    expect(res.status).toBe(200);
    const bid = await bidSchema.findOne({ productId: product._id });
    // 500 bags * 100 = 50000, NOT the client's fabricated 999999
    expect(bid.budgetQuation).toBe(50000);
  });

  it('rejects a productItemId that does not belong to this product', async () => {
    const { buyer, sellerToken, product } = await makeMultiItemRequirement();
    const fakeItemId = '507f1f77bcf86cd799439011';

    const res = await request(app)
      .post(`/api/v1/bid/create/${buyer._id}/${product._id}`)
      .set('Cookie', `authToken=${sellerToken}`)
      .field('items', JSON.stringify([{ productItemId: fakeItemId, unitPrice: 100 }]));

    expect(res.status).toBe(400);
    const bid = await bidSchema.findOne({ productId: product._id });
    expect(bid).toBeNull();
  });

  it('rejects an item with no unit price', async () => {
    const { buyer, sellerToken, product } = await makeMultiItemRequirement();
    const [cementItem] = product.items;

    const res = await request(app)
      .post(`/api/v1/bid/create/${buyer._id}/${product._id}`)
      .set('Cookie', `authToken=${sellerToken}`)
      .field('items', JSON.stringify([{ productItemId: cementItem._id.toString() }]));

    expect(res.status).toBe(400);
  });

  it('rejects a bid with neither items[] nor a positive budgetQuation', async () => {
    const { buyer, sellerToken, product } = await makeMultiItemRequirement();

    const res = await request(app)
      .post(`/api/v1/bid/create/${buyer._id}/${product._id}`)
      .set('Cookie', `authToken=${sellerToken}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('still supports a plain lump-sum bid with no items[] (single-item/document-upload RFQs)', async () => {
    const buyer = await userSchema.create({ phone: `+9198782${Math.floor(Math.random() * 100000)}` });
    const seller = await userSchema.create({ phone: `+9198783${Math.floor(Math.random() * 100000)}` });
    const sellerToken = seller.generateAuthToken();
    const product = await productSchema.create({ title: 'Single item RFQ', userId: buyer._id, draft: false });
    await requirementSchema.create({ productId: product._id, buyerId: buyer._id, sellers: [] });

    const res = await request(app)
      .post(`/api/v1/bid/create/${buyer._id}/${product._id}`)
      .set('Cookie', `authToken=${sellerToken}`)
      .field('budgetQuation', '15000');

    expect(res.status).toBe(200);
    const bid = await bidSchema.findOne({ productId: product._id });
    expect(bid.budgetQuation).toBe(15000);
    expect(bid.items).toHaveLength(0);
  });

  it('falls back to a quantity embedded in typeOfProduct when Product.items[].quantity is blank', async () => {
    // Some materials were entered with the real quantity/unit typed into
    // a free-text field (e.g. "TMT Reinforcement Bars - 2 MT") and
    // Quantity left empty. Product.items[] has no itemName/itemDescription
    // fields on the schema (Mongoose silently drops them), so typeOfProduct
    // is the real persisted field this ends up in. The server must not
    // silently price this as quantity=1 -- that's real money, wrong.
    const buyer = await userSchema.create({ phone: `+9198784${Math.floor(Math.random() * 100000)}` });
    const seller = await userSchema.create({ phone: `+9198785${Math.floor(Math.random() * 100000)}` });
    const sellerToken = seller.generateAuthToken();

    const product = await productSchema.create({
      title: 'TMT Bars RFQ',
      userId: buyer._id,
      draft: false,
      isMultiple: true,
      items: [
        { subCategoryName: 'TMT Bars', typeOfProduct: 'TMT Reinforcement Bars - 2 MT', quantityUnit: 'PCS' },
      ],
    });
    await requirementSchema.create({ productId: product._id, buyerId: buyer._id, sellers: [] });
    const savedProduct = await productSchema.findById(product._id).lean();
    const [tmtItem] = savedProduct.items;
    expect(tmtItem.quantity).toBeFalsy(); // confirms the fixture reproduces the bug precondition

    const items = [{ productItemId: tmtItem._id.toString(), unitPrice: 60000 }];

    const res = await request(app)
      .post(`/api/v1/bid/create/${buyer._id}/${product._id}`)
      .set('Cookie', `authToken=${sellerToken}`)
      .field('items', JSON.stringify(items));

    expect(res.status).toBe(200);
    const bid = await bidSchema.findOne({ productId: product._id });
    // 2 MT (parsed from the description) x 60000, NOT 1 x 60000
    expect(bid.budgetQuation).toBe(120000);
  });
});

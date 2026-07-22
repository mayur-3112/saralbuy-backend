import { describe, it, expect } from 'vitest';
import userSchema from '../src/models/user.schema.js';
import productSchema from '../src/models/product.schema.js';

// Confirms the indexes added in M1.T5 actually get used by the query shapes
// they were designed for — an index that Mongoose builds but that the query
// planner never picks is exactly as slow as no index at all.
function usesIndexScan(explainResult) {
  const stage = JSON.stringify(explainResult.queryPlanner.winningPlan);
  return stage.includes('IXSCAN');
}

describe('DB indexes are actually used by the real query shapes', () => {
  it('User.phone lookup (the OTP login path) uses an index scan', async () => {
    const explain = await userSchema.findOne({ phone: '+919876500001' }).explain('queryPlanner');
    expect(usesIndexScan(explain)).toBe(true);
  });

  it('the "is this RFQ open for quotes" predicate uses an index scan', async () => {
    const explain = await productSchema
      .find({ draft: false, isSoldProduct: false, bidExpiryDate: { $gt: new Date() } })
      .explain('queryPlanner');
    expect(usesIndexScan(explain)).toBe(true);
  });

  it('category-filtered browsing uses an index scan', async () => {
    const explain = await productSchema
      .find({ categoryId: '507f1f77bcf86cd799439011', draft: false, isSoldProduct: false })
      .explain('queryPlanner');
    expect(usesIndexScan(explain)).toBe(true);
  });

  it("a user's own drafts query uses an index scan", async () => {
    const explain = await productSchema
      .find({ userId: '507f1f77bcf86cd799439011', draft: true })
      .explain('queryPlanner');
    expect(usesIndexScan(explain)).toBe(true);
  });
});

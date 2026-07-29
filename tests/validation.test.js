import { describe, it, expect } from 'vitest';
import { updateProfileSchema } from '../src/validations/updateProfile.schema.js';
import { createBidSchema } from '../src/validations/createBid.schema.js';
import { addProductSchema } from '../src/validations/addProduct.schema.js';

describe('M3.T3 Zod schemas (validation-only, req.body untouched on success)', () => {
  describe('updateProfileSchema', () => {
    it('accepts a partial update with only one field', () => {
      expect(updateProfileSchema.safeParse({ firstName: 'Anmol' }).success).toBe(true);
    });
    it('accepts an empty body (all fields optional)', () => {
      expect(updateProfileSchema.safeParse({}).success).toBe(true);
    });
    it('rejects a malformed email', () => {
      const result = updateProfileSchema.safeParse({ email: 'not-an-email' });
      expect(result.success).toBe(false);
    });
    it('accepts an empty-string email (frontend sends "" for untouched field)', () => {
      expect(updateProfileSchema.safeParse({ email: '' }).success).toBe(true);
    });
    it('rejects an invalid accountRole', () => {
      expect(updateProfileSchema.safeParse({ accountRole: 'admin' }).success).toBe(false);
    });
  });

  describe('createBidSchema', () => {
    it('accepts a valid numeric-string budgetQuation (multipart form data)', () => {
      const result = createBidSchema.safeParse({ budgetQuation: '5000' });
      expect(result.success).toBe(true);
    });
    it('accepts a missing budgetQuation at the Zod layer -- items[] can supply it instead; the service enforces that one of the two is present', () => {
      expect(createBidSchema.safeParse({}).success).toBe(true);
    });
    it('accepts an items array (deep validation happens in bid.service.js against the real Product.items[])', () => {
      const result = createBidSchema.safeParse({
        items: JSON.stringify([{ productItemId: '507f1f77bcf86cd799439011', unitPrice: '500' }]),
      });
      expect(result.success).toBe(true);
    });
    it('rejects a zero/negative budgetQuation', () => {
      expect(createBidSchema.safeParse({ budgetQuation: '0' }).success).toBe(false);
      expect(createBidSchema.safeParse({ budgetQuation: '-100' }).success).toBe(false);
    });
    it('rejects a non-numeric budgetQuation', () => {
      expect(createBidSchema.safeParse({ budgetQuation: 'abc' }).success).toBe(false);
    });
    it('rejects an invalid businessType enum value', () => {
      expect(
        createBidSchema.safeParse({ budgetQuation: '100', businessType: 'nonsense' }).success
      ).toBe(false);
    });
    it('accepts businessDets as a JSON string (deep-parsed downstream, not here)', () => {
      const result = createBidSchema.safeParse({
        budgetQuation: '100',
        businessDets: JSON.stringify({ company_name: 'Acme' }),
      });
      expect(result.success).toBe(true);
    });
  });

  describe('addProductSchema', () => {
    it('accepts a minimal draft payload', () => {
      expect(addProductSchema.safeParse({ draft: 'true', title: 'Cement 50kg' }).success).toBe(true);
    });
    it('accepts an empty body (category existence is checked elsewhere, in the service)', () => {
      expect(addProductSchema.safeParse({}).success).toBe(true);
    });
    it('rejects an excessively long title (abuse/DoS-shaped input)', () => {
      const result = addProductSchema.safeParse({ title: 'x'.repeat(500) });
      expect(result.success).toBe(false);
    });
    it('accepts minimumBudget as an empty string (frontend untouched-field convention)', () => {
      expect(addProductSchema.safeParse({ minimumBudget: '' }).success).toBe(true);
    });
    it('rejects a negative minimumBudget', () => {
      expect(addProductSchema.safeParse({ minimumBudget: '-500' }).success).toBe(false);
    });
  });
});

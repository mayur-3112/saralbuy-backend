import { z } from 'zod';

// One of the 3 highest-risk endpoints named in M3.T3 — a supplier's priced
// quote. budgetQuation is a Number in bid.schema.js and arrives as a numeric
// string from multipart form data; z.coerce mirrors Mongoose's own casting
// so this doesn't reject anything Mongoose would otherwise accept.
export const createBidSchema = z.object({
  budgetQuation: z.coerce.number().positive('Budget must be greater than 0'),
  status: z.enum(['active', 'inactive']).optional(),
  availableBrand: z.string().trim().max(200).optional(),
  earliestDeliveryDate: z.coerce.date().optional(),
  businessType: z.enum(['individual', 'business']).optional(),
  sellerType: z.string().trim().max(100).optional(),
  priceBasis: z.string().trim().max(100).optional(),
  taxes: z.string().trim().max(50).optional(),
  freightTerms: z.string().trim().max(200).optional(),
  paymentTerms: z.string().trim().max(200).optional(),
  location: z.string().trim().max(200).optional(),
  buyerNote: z.string().trim().max(1000).optional(),
  // Arrives as a JSON string in the multipart quote-document flow — deep
  // shape validation already happens where it's parsed in
  // services/bid.service.js; not duplicated here.
  businessDets: z.any().optional(),
});

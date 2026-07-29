import { z } from 'zod';

// One of the 3 highest-risk endpoints named in M3.T3 — a supplier's priced
// quote. budgetQuation is a Number in bid.schema.js and arrives as a numeric
// string from multipart form data; z.coerce mirrors Mongoose's own casting
// so this doesn't reject anything Mongoose would otherwise accept.
export const createBidSchema = z.object({
  // Optional now: when `items` (below) carries a per-material breakdown,
  // the service derives budgetQuation server-side and ignores whatever the
  // client sent here. Only single-item/document-upload RFQs (no `items`)
  // still rely on this client-supplied figure — the service enforces that
  // one of the two is present; not duplicated here.
  budgetQuation: z.coerce.number().positive('Budget must be greater than 0').optional(),
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
  // Per-material quote lines (productItemId/offeredBrand/unitPrice/
  // availability/remarks) — arrives as a JSON string in the multipart
  // document-upload flow, same as businessDets. Deep shape/ownership
  // validation happens in services/bid.service.js (it needs the actual
  // Product.items[] to validate against, which isn't available here);
  // not duplicated at this layer.
  items: z.any().optional(),
});

import { z } from 'zod';

// Mirrors frontend_v2/src/validations/Schema.js's ProfileSchema in spirit,
// but every field stays optional here — updateProfile is a partial-update
// endpoint (the controller does `if (field !== undefined) updates.field = ...`
// for each one), so requiring a field here would break legitimate partial
// updates that only touch one or two fields.
export const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  email: z.union([z.literal(''), z.string().trim().email('Invalid email')]).optional(),
  phone: z.string().trim().min(6).max(20).optional(),
  address: z.string().trim().max(500).optional(),
  currentLocation: z.string().trim().max(200).optional(),
  businessName: z.string().trim().max(200).optional(),
  accountRole: z.enum(['buyer', 'supplier']).optional(),
  organizationName: z.string().trim().max(200).optional(),
  procurementRole: z.string().trim().max(200).optional(),
  supplierCategories: z.string().trim().max(500).optional(),
  // GSTIN format itself is already enforced by user.schema.js's pre-save
  // hook — not duplicated here, just a sane length bound.
  gstin: z.string().trim().max(20).optional(),
  roleInCompany: z.string().trim().max(200).optional(),
  website: z.string().trim().max(300).optional(),
  businessDescription: z.string().trim().max(2000).optional(),
  accomplishments: z.string().trim().max(2000).optional(),
  topProblemsSolved: z.string().trim().max(2000).optional(),
  // Arrives as a string from multipart form data; controller does
  // `Number(businessSince)` itself — just bound the string length here.
  businessSince: z.string().trim().max(10).optional(),
  businessPhone: z.string().trim().max(20).optional(),
  storeAddress: z.string().trim().max(500).optional(),
});

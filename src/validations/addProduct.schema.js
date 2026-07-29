import { z } from 'zod';

// One of the 3 highest-risk endpoints named in M3.T3 — RFQ posting.
// categoryId/subCategoryId existence checks already happen in
// services/product.service.js (against the actual Category collection,
// which Zod can't validate) — this layer only bounds the free-text fields
// and stays permissive on `draft`/JSON-string fields since those arrive
// as strings from multipart form data and the service already handles
// their string/boolean and JSON-string forms.
export const addProductSchema = z.object({
  title: z.string().trim().max(300).optional(),
  description: z.string().trim().max(5000).optional(),
  quantity: z.string().trim().max(50).optional(),
  quantityUnit: z.string().trim().max(50).optional(),
  minimumBudget: z.union([z.literal(''), z.coerce.number().nonnegative()]).optional(),
  brand: z.string().trim().max(200).optional(),
  brandName: z.string().trim().max(200).optional(),
  categoryId: z.string().optional(),
  subCategoryId: z.union([z.string(), z.array(z.string())]).optional(),
  draft: z.union([z.literal('true'), z.literal('false'), z.boolean()]).optional(),
  productType: z.string().trim().max(200).optional(),
  conditionOfProduct: z.string().trim().max(200).optional(),
  gender: z.string().trim().max(50).optional(),
  fuelType: z.string().trim().max(50).optional(),
  model: z.string().trim().max(200).optional(),
  color: z.string().trim().max(100).optional(),
  transmission: z.string().trim().max(50).optional(),
  toolType: z.string().trim().max(200).optional(),
  typeOfProduct: z.string().trim().max(200).optional(),
  typeOfVehicle: z.string().trim().max(200).optional(),
  rateAService: z.string().trim().max(200).optional(),
  additionalDeliveryAndPackage: z.string().trim().max(1000).optional(),
  bidActiveDuration: z.string().trim().max(10).optional(),
  // JSON-stringified in multipart form data — deep-parsed and validated
  // where it's used in services/product.service.js.
  oldProductValue: z.any().optional(),
  paymentAndDelivery: z.any().optional(),
});

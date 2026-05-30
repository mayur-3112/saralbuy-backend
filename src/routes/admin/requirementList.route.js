import express from 'express';
import auth from '../../middleware/auth.middleware.js';
import {
  adminRequirementListing,
  requirementListingById,
} from '../../controllers/admin/requirementList.controller.js';
const router = express.Router();

router.get('/get-requirement-listing', auth, adminRequirementListing);
router.get('/get-requirement-listing-by-id/:id', auth, requirementListingById);
export default router;

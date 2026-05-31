import express from 'express';
import { adminGetBidListing, getBidById } from '../../controllers/admin/bidList.controller.js';
import adminAuth from '../../middleware/adminAuth.middleware.js';

const router = express.Router();

router.get('/bid-listing', adminAuth, adminGetBidListing);
router.get('/get-bid-by-id/:id', adminAuth, getBidById);

export default router;

import express from 'express';
import { adminGetBidListing, getBidById } from '../../controllers/admin/bidList.controller.js';
import auth from '../../middleware/auth.middleware.js';

const router = express.Router();

router.get('/bid-listing', auth, adminGetBidListing);
router.get('/get-bid-by-id/:id', auth, getBidById);

export default router;

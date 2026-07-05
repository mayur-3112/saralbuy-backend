import express from 'express';
import { adminGetDeals, adminUpdateDealStatus } from '../../controllers/admin/deal.controller.js';
import adminAuth from '../../middleware/adminAuth.middleware.js';

const router = express.Router();

router.get('/', adminAuth, adminGetDeals);
router.patch('/:id/status', adminAuth, adminUpdateDealStatus);

export default router;

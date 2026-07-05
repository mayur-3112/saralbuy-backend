import express from 'express';
import {
  adminGetRfqList,
  adminUpdateRfqModeration,
} from '../../controllers/admin/rfqModeration.controller.js';
import adminAuth from '../../middleware/adminAuth.middleware.js';

const router = express.Router();

router.get('/', adminAuth, adminGetRfqList);
router.patch('/:id/moderation', adminAuth, adminUpdateRfqModeration);

export default router;

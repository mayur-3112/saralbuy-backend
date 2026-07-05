import express from 'express';
import {
  adminGetVerificationQueue,
  adminDecideVerification,
} from '../../controllers/admin/userVerification.controller.js';
import adminAuth from '../../middleware/adminAuth.middleware.js';

const router = express.Router();

router.get('/', adminAuth, adminGetVerificationQueue);
router.patch('/:id/decide', adminAuth, adminDecideVerification);

export default router;

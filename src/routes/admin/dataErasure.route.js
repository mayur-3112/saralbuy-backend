import express from 'express';
import {
  adminGetErasureQueue,
  anonymizeUser,
} from '../../controllers/admin/dataErasure.controller.js';
import adminAuth from '../../middleware/adminAuth.middleware.js';

const router = express.Router();

router.get('/', adminAuth, adminGetErasureQueue);
router.post('/:id/anonymize', adminAuth, anonymizeUser);

export default router;

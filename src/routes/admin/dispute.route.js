import express from 'express';
import { adminGetReports, adminResolveReport, adminCreateReport } from '../../controllers/admin/dispute.controller.js';
import adminAuth from '../../middleware/adminAuth.middleware.js';

const router = express.Router();

router.get('/', adminAuth, adminGetReports);
router.post('/', adminAuth, adminCreateReport);
router.patch('/:id/resolve', adminAuth, adminResolveReport);

export default router;

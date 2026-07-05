import express from 'express';
import { sendBlast, getBlastHistory } from '../../controllers/admin/notificationBlast.controller.js';
import adminAuth from '../../middleware/adminAuth.middleware.js';

const router = express.Router();

router.get('/history', adminAuth, getBlastHistory);
router.post('/send', adminAuth, sendBlast);

export default router;

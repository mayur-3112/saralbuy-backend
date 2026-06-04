import express from 'express';
import {
  getBanners,
  uploadBanner,
  BannerDetsById,
  updateBanner,
} from '../../controllers/admin/banner.controller.js';

import adminAuth from '../../middleware/adminAuth.middleware.js';
import { upload } from '../../utils/multer.js';

const router = express.Router();

router.route('/').post(adminAuth, upload.single('image'), uploadBanner).get(getBanners);

router.put('/:bannerId', adminAuth, upload.single('image'), updateBanner);
router.get('/get-banner/:bannerId', adminAuth, BannerDetsById);

export default router;

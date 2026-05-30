import express from 'express';
import {
  getBanners,
  uploadBanner,
  BannerDetsById,
  updateBanner
} from '../../controllers/admin/banner.controller.js';

import auth from '../../middleware/auth.middleware.js';
import { upload } from '../../utils/multer.js';

const router = express.Router();

router.route('/')
  .all(auth)
  .post(upload.single('image'), uploadBanner)
  .get(getBanners);

router.put('/:bannerId', auth,upload.single('image'), updateBanner);
router.get('/get-banner/:bannerId', auth, BannerDetsById);

export default router;
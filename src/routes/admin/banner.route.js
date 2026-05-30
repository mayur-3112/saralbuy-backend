import express from 'express';
import { getBanners, uploadBanner } from '../../controllers/admin/banner.controller.js';
import auth from '../../middleware/auth.middleware.js';
import { upload } from '../../utils/multer.js';
const router = express.Router();

router.route('/').all(auth).post(upload.single('image'), uploadBanner).get(getBanners);

export default router;

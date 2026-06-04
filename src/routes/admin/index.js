import express from 'express';
import bannerRoute from './banner.route.js';
import authRoute from './auth.route.js';
import dashboardRoute from './dashboard.route.js';
import bidListRoute from './bidList.route.js';
import requirementListRoute from './requirementList.route.js';
import adminAuth from '../../middleware/adminAuth.middleware.js';
import { ApiResponse } from '../../helpers/ApiReponse.js';
import uploadFile from '../../config/imageKit.config.js';
import { upload } from '../../utils/multer.js';
const router = express.Router();

router.get('/', (_, res) => {
  res.end('Admin Route...');
});

router.post('/bucket', adminAuth, upload.single('file'), async (req, res) => {
  try {
    console.log('file', req.file);
    if (!req.file) return ApiResponse.errorResponse(res, 400, 'No file uploaded');
    const document = req.file;
    let url;
    if (document) {
      url = await uploadFile(document);
    }
    const type = req.file.mimetype.startsWith('image/') ? 'image' : 'document';
    return ApiResponse.successResponse(res, 200, 'File uploaded successfully', {
      url,
      type,
      mimeType: req.file.mimetype,
      fileName: req.file.originalname,
      fileSize: req.file.size,
    });
  } catch (error) {
    return ApiResponse.errorResponse(res, 500, 'Error uploading files');
  }
});

const routes = [
  { path: '/banner', router: bannerRoute },
  { path: '/auth', router: authRoute },
  { path: '/dashboard', router: dashboardRoute },
  { path: '/bid', router: bidListRoute },
  { path: '/requirement', router: requirementListRoute },
];
routes.forEach(route => {
  router.use(route.path, route.router);
});

export default router;

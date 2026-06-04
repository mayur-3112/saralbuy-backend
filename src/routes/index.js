import express from 'express';
import userRouter from './user.route.js';
import categoryRouter from './category.route.js';
import productRouter from './product.route.js';
import bidRouter from './bid.route.js';
import requirementRouter from './requirement.route.js';
import cartRouter from './cart.route.js';
import notificationRouter from './notification.route.js';
import { allowUploadFields, upload } from '../utils/multer.js';
import { ApiResponse } from '../helpers/ApiReponse.js';
import uploadFile from '../config/imageKit.config.js';
import auth from '../middleware/auth.middleware.js';
upload;
const router = express.Router();


router.get('/', (_, res) => {
  res.end('User Route...');
});

router.post('/bucket', auth, upload.single('file'), async (req, res) => {
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

// const adminRoutes =[
//     {path:"/admin/auth",router:authRoute},
//     {path:"/admin/dashboard",router:dashboardRoute},
//     {path:"/admin/user",router:adminUserRouter},
//     {path:"/admin/bid",router:adminBannerRouter},
//     {path:"/admin/requirement",router:adminRequirementRouter},
// ]

const routes = [
  { path: '/category', router: categoryRouter },
  { path: '/product', router: productRouter },
  { path: '/user', router: userRouter },
  { path: '/bid', router: bidRouter },
  { path: '/requirement', router: requirementRouter },
  { path: '/cart', router: cartRouter },
  { path: '/notification', router: notificationRouter },
];

routes.forEach(route => {
  router.use(route.path, route.router);
});
export default router;

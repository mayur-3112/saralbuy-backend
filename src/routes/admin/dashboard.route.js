import express from 'express';
import adminAuth from '../../middleware/adminAuth.middleware.js';
import {
  getCategoriesNames,
  dashboardAnaltics,
  liveStats,
  populateProductsById,
  getSubCategoryCount,
  allProducts,
  getProductById,
  updateProductById,
} from '../../controllers/admin/dashboard.controller.js';
import { upload } from '../../utils/multer.js';
const router = express.Router();
router.use(adminAuth);
router.get('/get-categorie-names', getCategoriesNames);
router.get('/analtics', dashboardAnaltics);
router.get('/live-stats', liveStats);
router.get('/populate-products-by-id', populateProductsById);
router.get('/get-subcategory-count/:categoryId', getSubCategoryCount);
router.get('/all-products', allProducts);
router.get('/get-product/:productId', getProductById);
router.put('/update-product/:productId', upload.single('image'), updateProductById);
export default router;

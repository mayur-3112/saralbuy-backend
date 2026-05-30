import express from 'express';
import auth from '../../middleware/auth.middleware.js';
import {
  getCategoriesNames,
  dashboardAnaltics,
  populateProductsById,
  getSubCategoryCount,
  allProducts,
  getProductById,
  updateProductById,
} from '../../controllers/admin/dashboard.controller.js';
import { upload } from '../../utils/multer.js';
const router = express.Router();
router.use(auth);
router.get('/get-categorie-names', getCategoriesNames);
router.get('/analtics', dashboardAnaltics);
router.get('/populate-products-by-id', populateProductsById);
router.get('/get-subcategory-count/:categoryId', getSubCategoryCount);
router.get('/all-products', allProducts);
router.get('/get-product/:productId', getProductById);
router.put('/update-product/:productId', upload.single('image'), updateProductById);
export default router;

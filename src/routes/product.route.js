import express from 'express';
import auth from '../middleware/auth.middleware.js';
import { allowUploadFields } from '../utils/multer.js';
import {
  addProduct,
  getTrendingCategory,
  getHomeProducts,
  getProductByName,
  searchProductsController,
  getProductById,
  getAllDraftProducts,
  deleteDraftProduct,
  getDraftProductById,
  updateDraftStatus,
  saveAsDraft,
  getLiveExchangeStats,
} from '../controllers/product.controller.js';
const router = express.Router();

router.post('/add-product/:categoryId/:subCategoryId', auth, allowUploadFields(), addProduct);
router.get('/get-trending-category', getTrendingCategory);
router.get('/get-home-products', getHomeProducts);
router.get('/get-product/:productName', getProductByName);
router.get('/get-products-by-title/search', searchProductsController);
router.get('/get-product-by-id/:productId', getProductById);
router.get('/get-draft-products', auth, getAllDraftProducts);
router.get('/get-draft-product/:productId', auth, getDraftProductById);
router.delete('/delete-draft-product/:productId', auth, deleteDraftProduct);
router.patch('/updatedraft', auth, allowUploadFields(), updateDraftStatus);
router.put('/save_as_draft', auth, allowUploadFields(), saveAsDraft);
router.get('/live-stats', getLiveExchangeStats);
export default router;

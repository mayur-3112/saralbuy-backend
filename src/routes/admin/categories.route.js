import express from 'express';
import adminAuth from '../../middleware/adminAuth.middleware.js';
import {
  createSubcategory,
  getCategoryNameWise,
  updateCategory,
} from '../../controllers/admin/categories.controller.js';
const router = express.Router();

router
  .route('/')
  .all(adminAuth)
  .get(getCategoryNameWise)
  .put(updateCategory)
  .post(createSubcategory);

export default router;

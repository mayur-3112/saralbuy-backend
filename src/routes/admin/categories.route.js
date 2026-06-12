import express from 'express';
import adminAuth from '../../middleware/adminAuth.middleware.js';
import {
  createSubcategory,
  getCategoryNameWise,
  updateCategory,
  deleteSubCategory,
  createParentCategory,
} from '../../controllers/admin/categories.controller.js';
const router = express.Router();

router
  .route('/')
  .all(adminAuth)
  .get(getCategoryNameWise)
  .put(updateCategory)
  .post(createSubcategory)
  .delete(deleteSubCategory);

router
  .route('/parent')
  .all(adminAuth)
  .post(createParentCategory);

export default router;


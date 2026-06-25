import express from 'express';
import { GetCategories, GetCategoriesById, SeedCategories } from '../controllers/category.controller.js';
const router = express.Router();

// router.post('/create-category',uploadSingleImage,CreateCategories)
router.get('/get-category/:categoryId', GetCategoriesById);
// router.put('/update-category/:categoryId',uploadSingleImage,UpdateCategory)
router.get('/get-category', GetCategories);
router.get('/seed-now', SeedCategories);
router.get('/', (req, res) => {
  res.send('category Index route');
});

export default router;

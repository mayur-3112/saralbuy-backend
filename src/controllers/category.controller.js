import { isValidObjectId } from 'mongoose';
import { ApiResponse } from '../helpers/ApiReponse.js';
import categorySchema from '../models/category.schema.js';
import redisClient from '../config/redis-config.js';
import redisHelper from '../helpers/redisHelper.js';
import fs from 'fs';
import path from 'path';

export const GetCategories = async (req, res) => {
  try {
    const isCacheData = await redisHelper.get('categories');
    if (isCacheData) {
      console.log('cache categories...');
      return ApiResponse.successResponse(res, 200, 'categories fetched successfully', isCacheData);
    }
    const categories = await categorySchema.find().lean();
    await redisHelper.set('categories', categories, 24 * 60 * 60);
    return ApiResponse.successResponse(res, 200, 'categories fetched successfully', categories);
  } catch (error) {
    return ApiResponse.errorResponse(res, 400, error?.response || error, null);
  }
};

export const GetCategoriesById = async (req, res) => {
  const { categoryId } = req.params;
  try {
    if (!isValidObjectId(categoryId))
      return ApiResponse.errorResponse(res, 400, 'Invalid category ID');

    const cacheKey = `category_${categoryId}`;
    const cachedCategory = await redisHelper.get(cacheKey);
    if (cachedCategory) {
      return ApiResponse.successResponse(res, 200, 'Category fetched successfully', cachedCategory);
    }

    const category = await categorySchema.findById(categoryId).lean();
    if (!category) return ApiResponse.errorResponse(res, 404, 'Category not found');

    await redisHelper.set(cacheKey, category, 24 * 60 * 60);
    return ApiResponse.successResponse(res, 200, 'Category fetched successfully', category);
  } catch (err) {
    console.log(err);
    return ApiResponse.errorResponse(res, 400, err.message);
  }
};

export const SeedCategories = async (req, res) => {
  try {
    const seedDataPath = path.resolve(process.cwd(), 'scripts/categories.json');
    const seedData = JSON.parse(fs.readFileSync(seedDataPath, 'utf8'));

    await categorySchema.deleteMany({});
    const inserted = await categorySchema.insertMany(seedData);
    
    await redisHelper.del('categories');

    return ApiResponse.successResponse(res, 200, 'Categories seeded successfully', inserted);
  } catch (error) {
    console.error('Seed error:', error);
    return ApiResponse.errorResponse(res, 500, error.message);
  }
};

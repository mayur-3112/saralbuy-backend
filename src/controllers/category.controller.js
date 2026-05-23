import { isValidObjectId } from 'mongoose';
import { ApiResponse } from '../helpers/ApiReponse.js';
import categorySchema from '../models/category.schema.js';
import redisClient from '../config/redis-config.js';
import redisHelper from '../helpers/redisHelper.js';
export const GetCategories = async (req, res) => {
  try {
    const isCacheData = await redisHelper.get('categories');
    if (isCacheData !== false) {
      console.log('cache categories...');
      return ApiResponse.successResponse(res, 200, 'categories fetched successfully', isCacheData);
    }
    const categories = await categorySchema.find().lean();
    await redisHelper.set('categories', categories);
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
    const category = await categorySchema.findById(categoryId).lean();
    if (!category) return ApiResponse.errorResponse(res, 404, 'Category not found');
    return ApiResponse.successResponse(res, 200, 'Category fetched successfully', category);
  } catch (err) {
    console.log(err);
    return ApiResponse.errorResponse(res, 400, err.message);
  }
};

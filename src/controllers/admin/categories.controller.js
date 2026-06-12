import mongoose from 'mongoose';
import { ApiResponse } from '../../helpers/ApiReponse.js';
import categorySchema from '../../models/category.schema.js';
import productSchema from '../../models/product.schema.js';
import redisHelper from '../../helpers/redisHelper.js';

export const getCategoryNameWise = async (req, res) => {
  try {
    const category = req.query.category || req.params.category;
    const query = category ? { categoryName: category } : {};
    const categoryData = await categorySchema.findOne(query).lean();
    return ApiResponse.successResponse(res, 200, 'category fetched', categoryData);
  } catch (error) {
    return ApiResponse.errorResponse(res, 500, 'something went wrong', error);
  }
};

export const updateCategory = async (req, res) => {
  try {
    const { categoryId, subCategory, categoryName } = req.body;
    console.log(req.body);

    if (categoryId && categoryName) {
      const findCategory = await categorySchema.findOne({ _id: categoryId });
      if (findCategory) {
        findCategory.categoryName = categoryName;
        await findCategory.save();
        await redisHelper.del('categories');
        await redisHelper.del(`category_${categoryId}`);
        return ApiResponse.successResponse(res, 200, 'category updated', findCategory);
      }
    }

    const findCategory = await categorySchema.findOne({ _id: categoryId }).select('subCategories');
    const subCategoryIndex = findCategory.subCategories.findIndex(
      item => item._id.toString() === subCategory._id.toString()
    );
    if (subCategoryIndex === -1) {
      return ApiResponse.errorResponse(res, 404, 'Subcategory not found');
    }

    findCategory.subCategories[subCategoryIndex].name = subCategory.name;

    await findCategory.save();
    await redisHelper.del('categories');
    await redisHelper.del(`category_${categoryId}`);

    console.log('UPDATED:', findCategory);

    return ApiResponse.successResponse(res, 200, 'category updated', findCategory);
  } catch (error) {
    console.log(error);
    return ApiResponse.errorResponse(res, 500, 'something went wrong', error);
  }
};

export const createSubcategory = async (req, res) => {
  const { categoryId, categoryName, brands } = req.body;
  console.log(req.body);
  if (!categoryId || !categoryName || !brands) {
    return ApiResponse.errorResponse(res, 400, 'please provide all required fields');
  }
  try {
    const findCategory = await categorySchema.findOne({ _id: categoryId }).select('subCategories');
    const subCategoryIndex = findCategory.subCategories.findIndex(
      item => item.name === categoryName
    );
    if (subCategoryIndex !== -1) {
      return ApiResponse.errorResponse(res, 400, 'category already exists');
    }

    findCategory.subCategories.push({ name: categoryName, brands });

    await findCategory.save();
    await redisHelper.del('categories');
    await redisHelper.del(`category_${categoryId}`);
    return ApiResponse.successResponse(res, 200, 'category created', findCategory);
  } catch (error) {
    console.log(error);
    return ApiResponse.errorResponse(res, 500, 'something went wrong', error);
  }
};

export const deleteSubCategory = async (req, res) => {
  const { categoryId, subCategoryId } = req.body;
  console.log(req.body);
  try {
    // Check if there are any products using this subcategory
    const productCount = await productSchema.countDocuments({ subCategoryId });
    if (productCount > 0) {
      return ApiResponse.errorResponse(
        res,
        400,
        `Cannot delete subcategory. It is associated with ${productCount} active product(s).`
      );
    }

    const findCategory = await categorySchema.findOne({ _id: categoryId }).select('subCategories');
    const subCategoryIndex = findCategory.subCategories.findIndex(
      item => item._id.toString() === subCategoryId
    );
    if (subCategoryIndex === -1) {
      return ApiResponse.errorResponse(res, 400, 'category not found');
    }
    findCategory.subCategories.splice(subCategoryIndex, 1);
    await findCategory.save();
    await redisHelper.del('categories');
    await redisHelper.del(`category_${categoryId}`);
    return ApiResponse.successResponse(res, 200, 'category deleted', findCategory);
  } catch (error) {
    console.log(error);
    return ApiResponse.errorResponse(res, 500, 'something went wrong', error);
  }
};

export const createParentCategory = async (req, res) => {
  const { categoryName, title, description, image } = req.body;
  if (!categoryName) {
    return ApiResponse.errorResponse(res, 400, 'Category name is required');
  }
  try {
    const existing = await categorySchema.findOne({ categoryName });
    if (existing) {
      return ApiResponse.errorResponse(res, 400, 'Category already exists');
    }
    const newCategory = await categorySchema.create({
      categoryName,
      title: title || '',
      description: description || '',
      image: image || '',
      subCategories: [],
    });
    await redisHelper.del('categories');
    return ApiResponse.successResponse(res, 201, 'Category created successfully', newCategory);
  } catch (error) {
    console.error(error);
    return ApiResponse.errorResponse(res, 500, 'something went wrong', error);
  }
};


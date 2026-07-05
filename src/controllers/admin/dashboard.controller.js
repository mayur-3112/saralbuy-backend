import { isValidObjectId } from 'mongoose';
import { ApiResponse } from '../../helpers/ApiReponse.js';
import categorySchema from '../../models/category.schema.js';
import userSchema from '../../models/user.schema.js';
import productSchema from '../../models/product.schema.js';
import mongoose from 'mongoose';
import requirementSchema from '../../models/requirement.schema.js';
import redisHelper from '../../helpers/redisHelper.js';
import uploadFile from '../../config/imageKit.config.js';
import bidSchema from '../../models/bid.schema.js';
import closeDealSchema from '../../models/closeDeal.schema.js';
export const liveStats = async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);

    const [
      activeRfqs,
      quotesToday,
      dealsToday,
      dealsCompletedToday,
      pendingVerifications,
      pendingModeration,
      newUsersToday,
      dealsThisWeek,
      quotesThisWeek,
    ] = await Promise.all([
      productSchema.countDocuments({ draft: { $ne: true }, bidExpiryDate: { $gte: now } }),
      bidSchema.countDocuments({ createdAt: { $gte: todayStart } }),
      closeDealSchema.countDocuments({ createdAt: { $gte: todayStart } }),
      closeDealSchema.countDocuments({ closedDealStatus: 'completed', updatedAt: { $gte: todayStart } }),
      userSchema.countDocuments({ verificationStatus: 'pending' }),
      productSchema.countDocuments({ moderationStatus: 'pending', draft: { $ne: true } }),
      userSchema.countDocuments({ createdAt: { $gte: todayStart } }),
      // last 7 days deals per day
      closeDealSchema.aggregate([
        { $match: { createdAt: { $gte: weekStart } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      // last 7 days quotes per day
      bidSchema.aggregate([
        { $match: { createdAt: { $gte: weekStart } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
    ]);

    return ApiResponse.successResponse(res, 200, 'Live stats fetched', {
      activeRfqs,
      quotesToday,
      dealsToday,
      dealsCompletedToday,
      pendingVerifications,
      pendingModeration,
      newUsersToday,
      dealsThisWeek,
      quotesThisWeek,
    });
  } catch (error) {
    console.error(error);
    return ApiResponse.errorResponse(res, 500, 'Error fetching live stats');
  }
};

export const getCategoriesNames = async (req, res) => {
  try {
    const categories = await categorySchema
      .find()
      .collation({
        locale: 'en',
        strength: 2,
      })
      .sort({
        categoryName: 1,
      })
      .select('categoryName subCategories _id');
    ApiResponse.successResponse(res, 200, 'categories fetched successfully', categories);
  } catch (error) {
    ApiResponse.errorResponse(res, 400, error.message);
  }
};

export const dashboardAnaltics = async (req, res) => {
  try {
    let key = 'cache:admin-dashboard-analytics';
    const cache = await redisHelper.get(key);
    if (cache) {
      console.log('from chache analytics dashboard....');
      return ApiResponse.successResponse(res, 200, 'data fetched successfully', JSON.parse(cache));
    }
    const activeUsers = await userSchema.find({ status: 'active' }).lean().countDocuments();
    const inactiveUsers = await userSchema.find({ status: 'inactive' }).lean().countDocuments();
    const user = await userSchema.find().lean().countDocuments();
    const products = await productSchema.find().lean().countDocuments();
    const requirements = await requirementSchema
      .find({
        'sellers.0': { $exists: true },
      })
      .lean()
      .countDocuments();
    const bids = await bidSchema.find().lean().countDocuments();
    const closedDeals = await closeDealSchema.find({ closedDealStatus: 'completed' }).lean().countDocuments();
    
    const recentProductCreated = await productSchema
      .find({ draft: false })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate({
        path: 'categoryId',
        select: 'categoryName',
      });
    let response = {
      users: {
        activeUsers,
        inactiveUsers,
        user,
      },
      products,
      requirements,
      bids,
      closedDeals,
      recentProductCreated,
    };
    await redisHelper.set(key, JSON.stringify(response), 3600);
    ApiResponse.successResponse(res, 201, 'dashbaoard data fetched', response);
  } catch (error) {
    ApiResponse.errorResponse(res, 500, error.message);
  }
};

export const populateProductsById = async (req, res) => {
  const categoryId = req.query.categoryId;
  try {
    if (!categoryId) {
      const products = await productSchema.aggregate([
        {
          $group: {
            _id: '$categoryId',
            productCount: { $sum: 1 },
          },
        },
        {
          $lookup: {
            from: 'categories',
            localField: '_id',
            foreignField: '_id',
            as: 'category',
          },
        },
        {
          $unwind: '$category',
        },
        {
          $project: {
            categoryName: '$category.categoryName',
            productCount: 1,
          },
        },
      ]);
      ApiResponse.successResponse(res, 201, 'products fetched', products);
    } else {
      const products = await productSchema.aggregate([
        {
          $match: { categoryId },
        },
        {
          $group: {
            _id: '$categoryId',
            products: { $push: '$_id' },
          },
        },
      ]);
      ApiResponse.successResponse(res, 201, 'products fetched', products);
    }
  } catch (error) {
    ApiResponse.errorResponse(res, 500, error.message);
  }
};

export const getSubCategoryCount = async (req, res) => {
  const { categoryId } = req.params;
  if (!isValidObjectId(categoryId)) {
    ApiResponse.errorResponse(res, 400, 'Invalid category id');
    return;
  }
  try {
    const subCategories = await categorySchema.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(categoryId),
        },
      },
      { $unwind: '$subCategories' },
      {
        $lookup: {
          from: 'products',
          localField: 'subCategories._id',
          foreignField: 'subCategoryId',
          as: 'matchedProducts',
        },
      },
      {
        $group: {
          _id: '$subCategories._id',
          name: { $first: '$subCategories.name' },
          count: { $sum: { $size: '$matchedProducts' } },
        },
      },
    ]);
    return res.send(subCategories);
  } catch (error) {
    console.log(error);
    res.status(400).send(error.message);
  }
};

export const allProducts = async (req, res) => {
  try {
    let { page = 1, limit = 10, text = null } = req.query;
    page = parseInt(page);
    limit = parseInt(limit);
    const skip = (page - 1) * limit;
    text = text?.trim() || '';
    console.log(text);
    const matchStage = {};
    if (text) {
      matchStage.$or = [
        { title: { $regex: text, $options: 'i' } },
        { brand: { $regex: text, $options: 'i' } },
        { description: { $regex: text, $options: 'i' } },
        { 'categoryId.categoryName': { $regex: text, $options: 'i' } },
      ];
    }

    const products = await productSchema.aggregate([
      {
        $lookup: {
          from: 'categories',
          localField: 'categoryId',
          foreignField: '_id',
          as: 'categoryId',
        },
      },
      { $unwind: { path: '$categoryId', preserveNullAndEmptyArrays: true } },
      { $match: matchStage },
      { $skip: skip },
      { $limit: limit },
    ]);

    const totalCountResult = await productSchema.aggregate([
      {
        $lookup: {
          from: 'categories',
          localField: 'categoryId',
          foreignField: '_id',
          as: 'categoryId',
        },
      },
      { $unwind: { path: '$categoryId', preserveNullAndEmptyArrays: true } },
      { $match: matchStage },
      { $count: 'total' },
    ]);

    const totalProducts = totalCountResult[0]?.total || 0;
    const totalPages = Math.ceil(totalProducts / limit);

    ApiResponse.successResponse(res, 200, 'products fetched', {
      products,
      page,
      totalPages,
      totalProducts,
    });
  } catch (error) {
    console.log(error);
    ApiResponse.errorResponse(res, 400, error.message);
  }
};

export const getProductById = async (req, res) => {
  const { productId } = req.params;
  try {
    const product = await productSchema.findById(productId).populate('categoryId');
    ApiResponse.successResponse(res, 200, 'product fetched', product);
  } catch (error) {
    ApiResponse.errorResponse(res, 400, error.message);
  }
};

export const updateProductById = async (req, res) => {
  const { productId } = req.params;
  console.log(req.files);
  const { title, description, minimumBudget } = req.body;
  if (minimumBudget < 0) {
    return ApiResponse.errorResponse(res, 400, 'Minimum budget should be greater than 0');
  }
  let bucket, imageKey;
  try {
    const product = await productSchema.findById(productId).populate('categoryId');
    if (!product) {
      return ApiResponse.errorResponse(res, 404, 'Product not found');
    }
    if (req?.file) {
      const location = await uploadFile(req.file);
      product.image = location;
    }
    product.minimumBudget = minimumBudget;
    product.title = title;
    product.description = description;
    await product.save();
    ApiResponse.successResponse(res, 200, 'product updated successfully', product);
  } catch (error) {
    ApiResponse.errorResponse(res, 400, error.message);
  }
};

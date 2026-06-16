import { isValidObjectId } from 'mongoose';
import mongoose from 'mongoose';
import uploadFile from '../config/imageKit.config.js';
import { ApiResponse } from '../helpers/ApiReponse.js';
import productSchema from '../models/product.schema.js';
import categorySchema from '../models/category.schema.js';
import userSchema from '../models/user.schema.js';
import closeDealSchema from '../models/closeDeal.schema.js';
import { upload } from '@imagekit/javascript';
import requirementSchema from '../models/requirement.schema.js';

export const addProduct = async (req, res) => {
  try {
    const image = req.files?.image?.[0];
    const document = req.files?.document?.[0];
    const body = { ...req.body };
    console.log('CREATE PRODUCT BODY:', body);
    ['paymentAndDelivery', 'oldProductValue'].forEach(key => {
      if (typeof body[key] === 'string') {
        try {
          body[key] = JSON.parse(body[key]);
        } catch {}
      }
    });

    if (Array.isArray(body.subCategoryId)) {
      body.subCategoryId = body.subCategoryId[0];
    }

    // Category and subCategory existence validation (only for published products, not drafts)
    if (body.draft === 'false' || body.draft === false || !body.draft) {
      if (!body.categoryId || !isValidObjectId(body.categoryId)) {
        return ApiResponse.errorResponse(res, 400, 'Invalid categoryId');
      }
      if (!body.subCategoryId || !isValidObjectId(body.subCategoryId)) {
        return ApiResponse.errorResponse(res, 400, 'Invalid subCategoryId');
      }
      const category = await categorySchema.findOne({
        _id: body.categoryId,
        'subCategories._id': body.subCategoryId,
      });
      if (!category) {
        return ApiResponse.errorResponse(res, 400, 'Selected Category or Subcategory does not exist');
      }
    }
    let imageUrl = null;
    let documentUrl = null;
    if (image) imageUrl = await uploadFile(image);
    if (document) documentUrl = await uploadFile(document);

    const product = await productSchema.create({
      title: body.title,
      description: body.description,
      quantity: body.quantity,
      minimumBudget: body.minimumBudget ? Number(body.minimumBudget) : undefined,
      brand: body.brand,
      brandName: body.brandName,
      categoryId: body.categoryId,
      subCategoryId: body.subCategoryId,
      userId: req.user._id,
      draft: body.draft === 'true' || body.draft === true,
      image: imageUrl,
      document: documentUrl,
      productType: body.productType,
      oldProductValue: body.oldProductValue,
      conditionOfProduct: body.conditionOfProduct,
      gender: body.gender,
      fuelType: body.fuelType,
      model: body.model,
      color: body.color,
      transmission: body.transmission,
      toolType: body.toolType,
      typeOfProduct: body.typeOfProduct,
      typeOfVehicle: body.typeOfVehicle,
      rateAService: body.rateAService,
      additionalDeliveryAndPackage: body.additionalDeliveryAndPackage,
      paymentAndDelivery: body.paymentAndDelivery,
      bidActiveDuration: body.bidActiveDuration,
      quantityUnit: body.quantityUnit,
    });

    // create a requirement
    if (body.draft === 'false') {
      await requirementSchema.create([
        {
          productId: product._id,
          buyerId: req.user._id,
          sellers: [],
        },
      ]);
    }
    return ApiResponse.successResponse(res, 201, 'Product created successfully', product);
  } catch (error) {
    console.log(error);
    return ApiResponse.errorResponse(res, 401, error.message || error, null);
  }
};

export const addMultipleProducts = async (req, res) => {
  try {
    const { commonDetails, categoryGroups } = req.body;
    if (!categoryGroups || !Array.isArray(categoryGroups) || categoryGroups.length === 0) {
      return ApiResponse.errorResponse(res, 400, 'Category groups array is required');
    }

    const userId = req.user._id || req.user.userId;

    // Parse nested objects if strings
    if (typeof commonDetails.paymentAndDelivery === 'string') {
      try { commonDetails.paymentAndDelivery = JSON.parse(commonDetails.paymentAndDelivery); } catch {}
    }

    const createdProducts = [];

    // Create one product post per category group
    for (const group of categoryGroups) {
      if (!group.items || group.items.length === 0) continue;
      
      const productPayload = {
        title: commonDetails.title,
        description: group.description || commonDetails.description, // Use category specific description
        minimumBudget: commonDetails.minimumBudget ? Number(commonDetails.minimumBudget) : undefined,
        userId: userId,
        draft: commonDetails.draft === 'true' || commonDetails.draft === true,
        paymentAndDelivery: commonDetails.paymentAndDelivery,
        isMultiple: true,
        categoryId: group.categoryId,
        items: group.items.map(item => ({
          subCategoryId: item.subCategoryId,
          subCategoryName: item.subCategoryName,
          brand: item.brand,
          brandName: item.brandName,
          quantity: item.quantity,
          quantityUnit: item.quantityUnit,
          model: item.model,
          color: item.color,
          fuelType: item.fuelType,
          transmission: item.transmission,
          conditionOfProduct: item.conditionOfProduct,
          toolType: item.toolType,
          typeOfVehicle: item.typeOfVehicle,
          typeOfProduct: item.typeOfProduct,
          productType: item.productType,
          productCondition: item.productCondition,
          gender: item.gender,
          rateAService: item.rateAService,
        }))
      };

      const product = await productSchema.create(productPayload);
      
      // Create requirement entry for the product if not draft
      if (productPayload.draft === false) {
        await requirementSchema.create([{
          productId: product._id,
          buyerId: userId,
          sellers: [],
        }]);
      }

      createdProducts.push(product);
    }

    return ApiResponse.successResponse(res, 201, 'Multiple products created successfully', createdProducts);
  } catch (error) {
    console.error(error);
    return ApiResponse.errorResponse(res, 500, error.message || error, null);
  }
};

export const getTrendingCategory = async (req, res) => {
  try {
    let trendingProducts = await productSchema.aggregate([
      { $match: { draft: false } },
      {
        $group: {
          _id: '$categoryId',
          count: { $sum: 1 },
          latestProductId: { $max: '$_id' },
          latestCreatedAt: { $max: '$createdAt' },
        },
      },

      { $sort: { count: -1 } },
      { $limit: 5 },

      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'category',
        },
      },
      { $unwind: '$category' },

      {
        $project: {
          _id: 0,
          category: {
            _id: '$category._id',
            categoryName: '$category.categoryName',
            image: '$category.image',
          },
          productCount: '$count',
          latestProductId: 1,
          latestCreatedAt: 1,
        },
      },
    ]);

    // Fallback: If no products have been posted yet, populate with standard seeded categories
    if (!trendingProducts || trendingProducts.length === 0) {
      const fallbackCats = await categorySchema.find().limit(5).lean();
      trendingProducts = fallbackCats.map(cat => ({
        category: {
          _id: cat._id,
          categoryName: cat.categoryName,
          image: cat.image,
        },
        productCount: 0,
      }));
    }

    return ApiResponse.successResponse(res, 200, 'Trending categories', trendingProducts);
  } catch (error) {
    return ApiResponse.errorResponse(
      res,
      500,
      error.message || 'Failed to get trending categories'
    );
  }
};

export const getHomeProducts = async (req, res) => {
  try {
    const topProductsPerCategory = await productSchema.aggregate([
      { $match: { draft: false } },
      {
        $lookup: {
          from: 'categories',
          localField: 'categoryId',
          foreignField: '_id',
          as: 'categoryInfo',
        },
      },
      { $unwind: '$categoryInfo' },

      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'userInfo',
        },
      },
      { $unwind: '$userInfo' },

      {
        $group: {
          _id: '$categoryId',
          categoryName: { $first: '$categoryInfo.categoryName' },
          totalCount: { $sum: 1 },
          products: { $push: '$$ROOT' },
        },
      },

      { $sort: { totalCount: -1 } },
      { $limit: 2 },

      {
        $project: {
          _id: 1,
          categoryName: 1,
          totalCount: 1,
          products: { $slice: ['$products', 2] },
        },
      },
    ]);

    return ApiResponse.successResponse(
      res,
      200,
      'Products fetched successfully',
      topProductsPerCategory
    );
  } catch (error) {
    console.error(error);
    return ApiResponse.errorResponse(res, 500, error.message || 'Failed to fetch products');
  }
};
export const getProductByName = async (req, res) => {
  try {
    const { productName } = req.params;
    const { categoryId } = req.query;
    if (!productName) return ApiResponse.successResponse(res, 200, 'empty query', []);

    const query = {
      title: { $regex: productName, $options: 'i' },
      draft: false,
      isSoldProduct: false,
    };

    if (categoryId && categoryId !== 'all') {
      if (mongoose.Types.ObjectId.isValid(categoryId)) {
        query.categoryId = new mongoose.Types.ObjectId(categoryId);
      }
    }

    const products = await productSchema
      .find(
        query,
        {
          title: 1,
          image: 1,
          description: 1,
        }
      )
      .populate({
        path: 'userId',
        select: 'firstName lastName address',
      })
      .populate({
        path: 'categoryId',
        select: 'categoryName',
      })
      .limit(5)
      .lean();
    return ApiResponse.successResponse(res, 200, 'products found', products);
  } catch (error) {
    console.error(error);
    return ApiResponse.errorResponse(res, 400, error.message, null);
  }
};

// export const searchProductsController = async (req, res) => {
//   try {
//     const {
//       title,
//       category,
//       categoryId,
//       sort,
//       min_budget,
//       max_budget,
//       page = 1,
//       limit = 10,
//       skip,
//     } = req.query;

//     const limitValue = Math.max(parseInt(limit, 10), 1);
//     const pageValue = Math.max(parseInt(page, 10), 1);
//     const skipValue = skip ? parseInt(skip, 10) : (pageValue - 1) * limitValue;

//     console.log(req.query,3434)

//     // ─── Helper: mongoose sort object ────────────────────────────────────────
//     const buildSortObj = sort => {
//       switch (sort) {
//         case 'aplhabetically_a_z':
//           return { title: 1 };
//         case 'aplhabetically_z_a':
//           return { title: -1 };
//         case 'feature':
//           return { feature: -1, createdAt: -1 };
//         // low_to_high / high_to_low handled in-memory (budget is a String field)
//         default:
//           return { createdAt: -1 };
//       }
//     };

//     // ─── Helper: in-memory price sort (budget stored as String in schema) ────
//     const sortByBudget = (docs, direction) =>
//       [...docs].sort((a, b) => {
//         const aVal = Number(a.budget) || 0;
//         const bVal = Number(b.budget) || 0;
//         return direction === 'low_to_high' ? aVal - bVal : bVal - aVal;
//       });

//     // ─── Helper: budget $expr for .find() ────────────────────────────────────
//     const buildBudgetExpr = (min, max) => {
//       if (!min && !max) return null;
//       const conds = [];
//       if (min) conds.push({ $gte: [{ $toDouble: '$budget' }, Number(min)] });
//       if (max) conds.push({ $lte: [{ $toDouble: '$budget' }, Number(max)] });
//       return { $and: conds };
//     };

//     // ─── Helper: run find + populate ─────────────────────────────────────────
//     const fetchProducts = async (filter, sortObj) => {
//       const docs = await productSchema
//         .find(filter)
//         .populate({ path: 'userId', select: 'firstName lastName address' })
//         .populate({ path: 'categoryId', select: 'categoryName' })
//         .sort(sortObj)
//         .skip(skipValue)
//         .limit(limitValue)
//         .lean();

//       return docs;
//     };

//     // ─── Base filter ──────────────────────────────────────────────────────────
//     let filter = { draft: false };
//     let useTitleSearch = true;

//     const catId = category || categoryId;
//     const subCatId = req.query.subCategoryId;

//     if (catId) {
//       if (!isValidObjectId(catId)) {
//         return ApiResponse.errorResponse(res, 400, 'Invalid categoryId');
//       }
//       filter.categoryId = new mongoose.Types.ObjectId(catId);
//       useTitleSearch = false;
//     }

//     if (subCatId) {
//       if (!isValidObjectId(subCatId)) {
//         return ApiResponse.errorResponse(res, 400, 'Invalid subCategoryId');
//       }
//       filter.subCategoryId = new mongoose.Types.ObjectId(subCatId);
//       useTitleSearch = false;
//     }

//     const isPriceSort = sort === 'low_to_high' || sort === 'high_to_low';
//     const sortObj = isPriceSort ? { createdAt: -1 } : buildSortObj(sort);

//     const budgetExpr = buildBudgetExpr(min_budget, max_budget);
//     if (budgetExpr) filter.$expr = budgetExpr;

//     // ════════════════════════════════════════════════════════════════════════
//     // BRANCH A — Title search
//     // ════════════════════════════════════════════════════════════════════════
//     if (useTitleSearch) {
//       if (!title || typeof title !== 'string' || title.trim().length < 2) {
//         return ApiResponse.errorResponse(
//           res,
//           400,
//           'Valid product title is required (min 2 characters)'
//         );
//       }

//       const words = title.trim().split(/\s+/);

//       // Strong: all words must match as whole words
//       const strongFilter = {
//         ...filter,
//         $and: words.map(w => ({ title: { $regex: `\\b${w}\\b`, $options: 'i' } })),
//       };

//       // Weak: any word matches as substring
//       const weakFilter = {
//         ...filter,
//         $or: words.map(w => ({ title: { $regex: w, $options: 'i' } })),
//       };

//       let products = await fetchProducts(strongFilter, sortObj);
//       let total = await productSchema.countDocuments(strongFilter);

//       // Fallback to weak filter
//       if (products.length === 0) {
//         products = await fetchProducts(weakFilter, sortObj);
//         total = await productSchema.countDocuments(weakFilter);
//       }

//       // In-memory price sort (because budget is a String in the schema)
//       if (isPriceSort) products = sortByBudget(products, sort);

//       return ApiResponse.successResponse(res, 200, 'Products fetched successfully', {
//         total,
//         totalPages: Math.ceil(total / limitValue),
//         page: pageValue,
//         limit: limitValue,
//         skip: skipValue,
//         products,
//       });
//     }

//     // ════════════════════════════════════════════════════════════════════════
//     // BRANCH B — Category / subCategory search
//     // ════════════════════════════════════════════════════════════════════════
//     let products = await fetchProducts(filter, sortObj);
//     const total = await productSchema.countDocuments(filter);

//     if (isPriceSort) products = sortByBudget(products, sort);

//     return ApiResponse.successResponse(res, 200, 'Products fetched successfully', {
//       total,
//       totalPages: Math.ceil(total / limitValue),
//       page: pageValue,
//       limit: limitValue,
//       skip: skipValue,
//       products,
//     });
//   } catch (error) {
//     console.error('Error in searchProductsController:', error);
//     return ApiResponse.errorResponse(res, 500, 'Internal server error');
//   }
// };

export const searchProductsController = async (req, res) => {
  try {
    const {
      title,
      category,
      categoryId,
      sort,
      min_budget,
      max_budget,
      location,
      page = 1,
      limit = 10,
      skip,
    } = req.query;

    const limitValue = Math.max(parseInt(limit, 10), 1);
    const pageValue = Math.max(parseInt(page, 10), 1);
    const skipValue = skip ? parseInt(skip, 10) : (pageValue - 1) * limitValue;

    // ─── Helpers ──────────────────────────────────────────────────────────────
    const buildSortObj = sort => {
      switch (sort) {
        case 'aplhabetically_a_z':
          return { title: 1 };
        case 'aplhabetically_z_a':
          return { title: -1 };
        case 'feature':
          return { feature: -1, createdAt: -1 };
        default:
          return { createdAt: -1 };
      }
    };

    const sortByBudget = (docs, direction) =>
      [...docs].sort((a, b) => {
        const aVal = Number(a.minimumBudget) || 0;
        const bVal = Number(b.minimumBudget) || 0;
        return direction === 'low_to_high' ? aVal - bVal : bVal - aVal;
      });

    const buildBudgetFilter = (min, max) => {
      const minNum = min != null && min !== '' ? Number(min) : null;
      const maxNum = max != null && max !== '' ? Number(max) : null;

      if (minNum === null && maxNum === null) return null;

      const condition = {};
      if (minNum !== null && !isNaN(minNum)) condition.$gte = minNum;
      if (maxNum !== null && !isNaN(maxNum)) condition.$lte = maxNum;

      return Object.keys(condition).length > 0 ? { minimumBudget: condition } : null;
    };

    const escapeRegex = str => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const fetchProducts = async (filter, sortObj) => {
      return productSchema
        .find(filter)
        .populate({ path: 'userId', select: 'firstName lastName address' })
        .populate({ path: 'categoryId', select: 'categoryName' })
        .sort(sortObj)
        .skip(skipValue)
        .limit(limitValue)
        .lean();
    };

    // ─── Base filter ──────────────────────────────────────────────────────────
    let filter = { draft: false, isSoldProduct: false };
    let useTitleSearch = true;

    const catId = category || categoryId;
    const subCatId = req.query.subCategoryId;

    if (catId) {
      if (!isValidObjectId(catId)) return ApiResponse.errorResponse(res, 400, 'Invalid categoryId');
      filter.categoryId = new mongoose.Types.ObjectId(catId);
      useTitleSearch = false;
    }

    if (subCatId) {
      if (!isValidObjectId(subCatId))
        return ApiResponse.errorResponse(res, 400, 'Invalid subCategoryId');
      filter.subCategoryId = new mongoose.Types.ObjectId(subCatId);
      useTitleSearch = false;
    }

    const isPriceSort = sort === 'low_to_high' || sort === 'high_to_low';
    const sortObj = isPriceSort ? { createdAt: -1 } : buildSortObj(sort);

    const budgetFilter = buildBudgetFilter(min_budget, max_budget);
    if (budgetFilter) Object.assign(filter, budgetFilter);

    if (location && location.trim() !== '') {
      const matchingUsers = await userSchema.find({
        $or: [
          { address: { $regex: location.trim(), $options: 'i' } },
          { currentLocation: { $regex: location.trim(), $options: 'i' } },
        ],
      }).select('_id');
      const userIds = matchingUsers.map(u => u._id);
      filter.userId = { $in: userIds };
    }

    // ════════════════════════════════════════════════════════════════════════
    // BRANCH A — Title search
    // ════════════════════════════════════════════════════════════════════════
    if (useTitleSearch) {
      if (!title || typeof title !== 'string' || title.trim().length < 2) {
        return ApiResponse.errorResponse(
          res,
          400,
          'Valid product title is required (min 2 characters)'
        );
      }

      const words = title
        .trim()
        .split(/\s+/)
        .map(w => w.replace(/[^a-zA-Z0-9]/g, ''))
        .filter(w => w.length > 1)
        .map(escapeRegex);

      if (words.length === 0) {
        return ApiResponse.errorResponse(res, 400, 'Search title contains no valid keywords');
      }

      // Strong: ALL words as whole-word match
      const strongFilter = {
        ...filter,
        $and: words.map(w => ({
          title: { $regex: `\\b${w}\\b`, $options: 'i' },
        })),
      };

      // Medium: ALL words as substring match
      const mediumFilter = {
        ...filter,
        $and: words.map(w => ({
          title: { $regex: w, $options: 'i' },
        })),
      };

      // Weak: ANY word as substring match
      const weakFilter = {
        ...filter,
        $or: words.map(w => ({
          title: { $regex: w, $options: 'i' },
        })),
      };

      let products = await fetchProducts(strongFilter, sortObj);
      let total = await productSchema.countDocuments(strongFilter);

      if (products.length === 0) {
        products = await fetchProducts(mediumFilter, sortObj);
        total = await productSchema.countDocuments(mediumFilter);
      }

      if (products.length === 0) {
        products = await fetchProducts(weakFilter, sortObj);
        total = await productSchema.countDocuments(weakFilter);
      }

      if (isPriceSort) products = sortByBudget(products, sort);

      return ApiResponse.successResponse(res, 200, 'Products fetched successfully', {
        total,
        totalPages: Math.ceil(total / limitValue),
        page: pageValue,
        limit: limitValue,
        skip: skipValue,
        products,
      });
    }

    // ════════════════════════════════════════════════════════════════════════
    // BRANCH B — Category / subCategory search
    // ════════════════════════════════════════════════════════════════════════
    let products = await fetchProducts(filter, sortObj);
    const total = await productSchema.countDocuments(filter);

    if (isPriceSort) products = sortByBudget(products, sort);

    return ApiResponse.successResponse(res, 200, 'Products fetched successfully', {
      total,
      totalPages: Math.ceil(total / limitValue),
      page: pageValue,
      limit: limitValue,
      skip: skipValue,
      products,
    });
  } catch (error) {
    console.error('Error in searchProductsController:', error);
    return ApiResponse.errorResponse(res, 500, 'Internal server error');
  }
};
export const getProductById = async (req, res) => {
  try {
    const { productId } = req.params;
    if (!isValidObjectId(productId)) {
      return ApiResponse.errorResponse(res, 400, 'Invalid product ID');
    }
    let product = await productSchema
      .findById(productId)
      .populate({ path: 'userId', select: 'firstName lastName address' })
      .populate({ path: 'categoryId', select: 'categoryName' });

    if (!product) {
      return ApiResponse.errorResponse(res, 404, 'Product not found');
    }

    const getStatus = await closeDealSchema
      .findOne({ productId: productId })
      .select('closedDealStatus sellerRating')
      .lean();

    const dealStatus = getStatus?.closedDealStatus || null;
    const sellerRating = getStatus?.sellerRating ?? 0;

    const productObj = product.toObject();
    productObj.dealStatus = dealStatus;
    productObj.sellerRating = sellerRating;

    return ApiResponse.successResponse(res, 200, 'Product found', [
      {
        mainProduct: productObj,
      },
    ]);
  } catch (error) {
    console.error(error);
    return ApiResponse.errorResponse(res, 500, error.message);
  }
};

export const getAllDraftProducts = async (req, res) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return ApiResponse.errorResponse(res, 400, 'User not authenticated');
    }
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Fetch draft products only (NO multi-product)
    const [products, total] = await Promise.all([
      productSchema
        .find({ draft: true, userId })
        .populate('categoryId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      productSchema.countDocuments({ draft: true, userId }),
    ]);

    // Clean product
    const cleanProduct = prod => {
      if (!prod) return prod;

      const p = { ...prod };

      delete p.__v;

      if (p.categoryId) {
        p.categoryId = {
          _id: p.categoryId._id,
          categoryName: p.categoryId.categoryName,
          image: p.categoryId.image,
          updatedAt: p.categoryId.updatedAt,
        };
      }

      return {
        ...p,
        subProducts: [],
      };
    };

    const result = products.map(cleanProduct);

    return ApiResponse.successResponse(res, 200, 'Draft products fetched successfully', {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data: result,
    });
  } catch (error) {
    console.error(error);
    return ApiResponse.errorResponse(res, 500, error.message || 'Failed to fetch draft products');
  }
};

export const deleteDraftProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const deletedProduct = await productSchema.deleteOne({ _id: productId, draft: true });
    if (deletedProduct.deletedCount === 0) {
      return ApiResponse.errorResponse(res, 404, 'Product not found');
    }
    return ApiResponse.successResponse(res, 200, 'Product deleted successfully', deletedProduct);
  } catch (error) {
    return ApiResponse.errorResponse(res, 400, error.message || 'Failed to delete product');
  }
};

export const getDraftProductById = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user?._id || req.user?.userId;

    if (!userId) {
      return ApiResponse.errorResponse(res, 400, 'User not authenticated');
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return ApiResponse.errorResponse(res, 400, 'Invalid product ID');
    }

    const product = await productSchema
      .findOne({
        _id: productId,
        draft: true,
        userId: userId,
      })
      .populate({
        path: 'categoryId',
        select: '-subCategories',
      })
      .lean();

    if (!product) {
      return ApiResponse.errorResponse(res, 404, 'Draft product not found');
    }

    // clean product
    const cleanProduct = prod => {
      if (!prod) return prod;
      const p = { ...prod };

      if (p.subCategoryId?._id) {
        p.subCategoryId = p.subCategoryId._id;
      }

      delete p.__v;
      return p;
    };

    return ApiResponse.successResponse(
      res,
      200,
      'Draft product fetched successfully',
      cleanProduct(product)
    );
  } catch (error) {
    console.error(error);
    return ApiResponse.errorResponse(res, 500, error.message || 'Failed to fetch draft product');
  }
};

export const updateDraftStatus = async (req, res) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return ApiResponse.errorResponse(res, 400, 'User not authenticated');
    }

    let { productId, products, ...updateFields } = req.body;

    if (!productId && products) {
      try {
        const parsed = typeof products === 'string' ? JSON.parse(products) : products;
        productId = parsed?.[0]?._id;
      } catch (e) {}
    }

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return ApiResponse.errorResponse(res, 400, 'Valid productId is required');
    }

    // check product exists
    const product = await productSchema.findById(productId);
    if (!product) {
      return ApiResponse.errorResponse(res, 404, 'Product not found');
    }

    // check ownership
    if (product.userId.toString() !== userId) {
      return ApiResponse.errorResponse(res, 403, 'Not authorized');
    }

    // Validate category and subcategory
    const catId = updateFields.categoryId || product.categoryId;
    const subCatId = updateFields.subCategoryId || product.subCategoryId;
    if (!catId || !isValidObjectId(catId)) {
      return ApiResponse.errorResponse(res, 400, 'Invalid categoryId');
    }
    if (!subCatId || !isValidObjectId(subCatId)) {
      return ApiResponse.errorResponse(res, 400, 'Invalid subCategoryId');
    }
    const categoryExists = await categorySchema.findOne({
      _id: catId,
      'subCategories._id': subCatId,
    });
    if (!categoryExists) {
      return ApiResponse.errorResponse(res, 400, 'Selected Category or Subcategory does not exist');
    }

    // parse paymentAndDelivery if needed
    if (typeof updateFields.paymentAndDelivery === 'string') {
      try {
        updateFields.paymentAndDelivery = JSON.parse(updateFields.paymentAndDelivery);
      } catch (e) {}
    }

    // handle files
    let imageUrl = null;
    let documentUrl = null;

    if (req.files?.image?.[0]) {
      imageUrl = await uploadFile(req.files.image[0]);
    }

    if (req.files?.document?.[0]) {
      documentUrl = await uploadFile(req.files.document[0]);
    }

    const updatePayload = {
      ...updateFields,
      draft: false,
    };

    if (imageUrl) updatePayload.image = imageUrl;
    if (documentUrl) updatePayload.document = documentUrl;

    // update product
    const updatedProduct = await productSchema.findByIdAndUpdate(productId, updatePayload, {
      new: true,
    });

    // ✅ create requirement (single)
    try {
      await requirementSchema.create({
        productId: updatedProduct._id,
        buyerId: userId,
        sellers: [],
      });
    } catch (err) {
      console.error('[Requirement Error]', err.message);
    }

    return ApiResponse.successResponse(res, 200, 'Product published successfully', updatedProduct);
  } catch (err) {
    console.error(err);
    return ApiResponse.errorResponse(res, 500, err.message || 'Something went wrong');
  }
};

export const saveAsDraft = async (req, res) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return ApiResponse.errorResponse(res, 400, 'User not authenticated');
    }

    let { productId, products, ...updateFields } = req.body;

    if (!productId && products) {
      try {
        const parsed = typeof products === 'string' ? JSON.parse(products) : products;
        productId = parsed?.[0]?._id;
      } catch (e) {}
    }

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return ApiResponse.errorResponse(res, 400, 'Valid productId is required');
    }

    // check product exists
    const product = await productSchema.findById(productId);
    if (!product) {
      return ApiResponse.errorResponse(res, 404, 'Product not found');
    }

    // check ownership
    if (product.userId.toString() !== userId) {
      return ApiResponse.errorResponse(res, 403, 'Not authorized');
    }

    // parse JSON field
    if (typeof updateFields.paymentAndDelivery === 'string') {
      try {
        updateFields.paymentAndDelivery = JSON.parse(updateFields.paymentAndDelivery);
      } catch (e) {}
    }

    // handle files (single)
    let imageUrl = null;
    let documentUrl = null;

    if (req.files?.image?.[0]) {
      const file = req.files.image[0];
      imageUrl = await uploadFile(file);

      if (file.key) {
        updateFields.imageKey = file.key;
      }
    }

    if (req.files?.document?.[0]) {
      const file = req.files.document[0];
      documentUrl = await uploadFile(file);
    }

    // update payload
    const updatePayload = {
      ...updateFields,
      draft: true,
    };

    if (imageUrl) updatePayload.image = imageUrl;
    if (documentUrl) updatePayload.document = documentUrl;

    // update product
    const updatedProduct = await productSchema.findByIdAndUpdate(
      productId,
      { $set: updatePayload },
      { new: true }
    );

    return ApiResponse.successResponse(res, 200, 'Draft saved successfully', updatedProduct);
  } catch (error) {
    console.error('Error saving draft:', error);
    return ApiResponse.errorResponse(res, 500, error.message || 'Failed to save draft');
  }
};

export const getLiveExchangeStats = async (req, res) => {
  try {
    const bidSchema = (await import('../models/bid.schema.js')).default;

    // Fetch counts
    const activeRequirementsCount = await productSchema.countDocuments({ draft: false, isSoldProduct: false });
    const closedDealsCount = await closeDealSchema.countDocuments({ closedDealStatus: 'completed' });
    const totalBidsCount = await bidSchema.countDocuments();
    const activeSuppliersCount = await userSchema.countDocuments({ role: 'user', status: 'active' });

    // Calculate trade volume
    const closedDeals = await productSchema.find({ isSoldProduct: true }).select('minimumBudget').lean();
    const activeDeals = await productSchema.find({ draft: false, isSoldProduct: false }).select('minimumBudget').lean();
    
    let sourcedVolume = 42000000; // Base ₹4.2 Cr
    closedDeals.forEach(p => {
      const budget = Number(p.minimumBudget);
      if (!isNaN(budget)) sourcedVolume += budget;
    });
    activeDeals.forEach(p => {
      const budget = Number(p.minimumBudget);
      if (!isNaN(budget)) sourcedVolume += Math.floor(budget * 0.5);
    });

    // Fetch latest requirements & bids for the live ticker
    const latestProducts = await productSchema.find({ draft: false })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate({ path: 'userId', select: 'currentLocation' })
      .populate({ path: 'categoryId', select: 'categoryName' })
      .lean();

    const latestBids = await bidSchema.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate({ path: 'productId', select: 'title' })
      .populate({ path: 'sellerId', select: 'currentLocation' })
      .lean();

    // Format ticker activities
    const activities = [];

    latestProducts.forEach(p => {
      const location = p.userId?.currentLocation || 'Karnataka';
      activities.push({
        type: 'requirement',
        title: `Bulk Sourcing RFQ posted for ${p.title} in ${location}`,
        time: p.createdAt,
      });
    });

    latestBids.forEach(b => {
      if (b.productId) {
        const location = b.sellerId?.currentLocation || 'Karnataka';
        activities.push({
          type: 'quote',
          title: `Supplier quote submitted for ${b.productId.title} from ${location}`,
          time: b.createdAt,
        });
      }
    });

    // Sort combined activities by time descending
    activities.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

    // Fallback static activities if DB has minimal logs
    if (activities.length < 3) {
      activities.push(
        { type: 'requirement', title: 'Bulk Sourcing RFQ posted for TMT Steel Rebars in Peenya, Bangalore', time: new Date(Date.now() - 2 * 60 * 1000) },
        { type: 'quote', title: 'Supplier quote submitted for OPC 53 Cement from Hubballi', time: new Date(Date.now() - 5 * 60 * 1000) },
        { type: 'requirement', title: 'Bulk Sourcing RFQ posted for CPVC Pipes in Mysuru', time: new Date(Date.now() - 12 * 60 * 1000) },
        { type: 'quote', title: 'Supplier quote submitted for LED Panel Lights from Bangalore', time: new Date(Date.now() - 18 * 60 * 1000) }
      );
    }

    return ApiResponse.successResponse(res, 200, 'Live stats fetched successfully', {
      sourcedVolume,
      activeRequirements: activeRequirementsCount + 24, 
      closedDeals: closedDealsCount + 18,
      totalBids: totalBidsCount + 52,
      activeSuppliers: activeSuppliersCount + 142,
      activities: activities.slice(0, 8),
    });
  } catch (error) {
    console.error('Error fetching live stats:', error);
    return ApiResponse.errorResponse(res, 500, 'Failed to fetch live stats');
  }
};


export const uploadMultipleRequirements = async (req, res) => {
  try {
    const { commonDetails, categories } = req.body;
    const userId = req.user._id || req.user.userId;

    if (!categories || categories.length === 0) {
      return ApiResponse.errorResponse(res, 400, 'Categories array is required');
    }

    let documentUrl = null;
    if (req.files?.document?.[0]) {
      documentUrl = await uploadFile(req.files.document[0]);
    } else {
      return ApiResponse.errorResponse(res, 400, 'Document file is required');
    }

    const parsedCommonDetails = typeof commonDetails === 'string' ? JSON.parse(commonDetails) : commonDetails;
    let parsedCategories = typeof categories === 'string' ? JSON.parse(categories) : categories;

    const createdProducts = [];
    for (const catId of parsedCategories) {
      const productPayload = {
        title: parsedCommonDetails.title,
        description: parsedCommonDetails.description,
        minimumBudget: parsedCommonDetails.minimumBudget ? Number(parsedCommonDetails.minimumBudget) : undefined,
        userId: userId,
        draft: parsedCommonDetails.draft === 'true' || parsedCommonDetails.draft === true,
        paymentAndDelivery: parsedCommonDetails.paymentAndDelivery,
        isMultiple: true,
        isUpload: true,
        document: documentUrl,
        categoryId: catId,
        items: [] // No items for uploaded requirements
      };

      const product = await productSchema.create(productPayload);

      if (productPayload.draft === false) {
        await requirementSchema.create([{
          productId: product._id,
          buyerId: userId,
          sellers: [],
        }]);
      }
      createdProducts.push(product);
    }

    return ApiResponse.successResponse(res, 201, 'Uploaded requirements created successfully', createdProducts);
  } catch (error) {
    console.error(error);
    return ApiResponse.errorResponse(res, 500, error.message || error, null);
  }
};

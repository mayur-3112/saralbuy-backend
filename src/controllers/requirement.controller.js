import mongoose from 'mongoose';
import { ApiResponse } from '../helpers/ApiReponse.js';
import requirementSchema from '../models/requirement.schema.js';
import productSchema from '../models/product.schema.js';
import closeDealSchema from '../models/closeDeal.schema.js';

export const getRecentRequirements = async (req, res) => {
  try {
    let requirements = await requirementSchema.aggregate([
      {
        $lookup: {
          from: 'products',
          localField: 'productId',
          foreignField: '_id',
          as: 'productId',
        },
      },
      { $unwind: '$productId' },
      {
        $match: {
          'productId.draft': false,
          'productId.isSoldProduct': false,
          'productId.bidExpiryDate': { $not: { $lt: new Date() } },
        },
      },
      {
        $lookup: {
          from: 'categories',
          let: { categoryId: '$productId.categoryId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$_id', '$$categoryId'],
                },
              },
            },
          ],
          as: 'productId.categoryId',
        },
      },
      { $unwind: '$productId.categoryId' },
      {
        $lookup: {
          from: 'users',
          localField: 'buyerId',
          foreignField: '_id',
          as: 'buyerId',
        },
      },
      { $unwind: '$buyerId' },
      { $sort: { createdAt: -1 } },
      { $limit: 3 },
    ]);

    return ApiResponse.successResponse(res, 200, 'Requirements fetched successfully', requirements);
  } catch (error) {
    console.log(error);
    return ApiResponse.errorResponse(res, 400, 'Something went wrong while getting requirements');
  }
};

export const createRequirement = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { productId, sellerId, buyerId, budgetAmount } = req.body;

    if (!mongoose.Types.ObjectId.isValid(productId) || !mongoose.Types.ObjectId.isValid(sellerId)) {
      return ApiResponse.errorResponse(res, 400, 'Invalid productId or sellerId');
    }
    if (!buyerId || !mongoose.Types.ObjectId.isValid(buyerId)) {
      return ApiResponse.errorResponse(res, 400, 'Invalid buyerId');
    }
    if (typeof budgetAmount !== 'number' || isNaN(budgetAmount)) {
      return ApiResponse.errorResponse(res, 400, 'Invalid budgetAmount');
    }

    // check product exists
    const product = await productSchema.findById(productId);
    if (!product) {
      return ApiResponse.errorResponse(res, 404, 'Product not found');
    }

    // check if requirement for this product & buyer exists
    let requirement = await requirementSchema.findOne({ productId, buyerId });

    if (requirement) {
      // check if seller already exists in sellers array
      const existingSeller = requirement.sellers.find(s => s.sellerId.toString() === sellerId);

      if (existingSeller) {
        // update budgetAmount if seller already exists
        existingSeller.budgetAmount = budgetAmount;
      } else {
        // add new seller entry
        requirement.sellers.push({ sellerId, budgetAmount });
      }

      await requirement.save();
      return ApiResponse.successResponse(res, 200, 'Requirement updated successfully', requirement);
    } else {
      // create new requirement with sellers array
      requirement = new requirementSchema({
        productId,
        buyerId,
        sellers: [{ sellerId, budgetAmount }],
      });

      await requirement.save();
      return ApiResponse.successResponse(res, 201, 'Requirement created successfully', requirement);
    }
  } catch (err) {
    console.error(err);
    return ApiResponse.errorResponse(res, 500, err.message || 'Failed to create requirement');
  }
};

export const getBuyerRequirements = async (req, res) => {
  try {
    const buyerId = req.user?.userId;

    if (!buyerId) {
      return ApiResponse.errorResponse(res, 400, 'Buyer not authenticated');
    }

    // ✅ Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // ✅ Fetch requirements (NO multi-product)
    const [requirements, total] = await Promise.all([
      requirementSchema
        .find({ buyerId, isDelete: false })
        .populate({
          path: 'productId',
          populate: { path: 'categoryId', select: '-subCategories' },
        })
        .populate('buyerId')
        .populate({
          path: 'sellers.sellerId',
          select: '-password -__v',
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      requirementSchema.countDocuments({ buyerId, isDelete: false }),
    ]);

    // ✅ Clean product
    const cleanProduct = prod => {
      if (!prod) return null;

      const p = { ...prod };

      if (p.userId?._id) p.userId = p.userId._id.toString();
      if (p.subCategoryId?._id) p.subCategoryId = p.subCategoryId._id;

      delete p.__v;

      return {
        ...p,
        subProducts: [], // keep structure same
      };
    };

    // ✅ Format date
    const formatDate = date => {
      if (!date) return null;
      const d = new Date(date);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    // ✅ Final mapping
    const result = requirements.map(reqItem => ({
      _id: reqItem._id,
      status: reqItem.status,
      createdAt: reqItem.createdAt,
      updatedAt: reqItem.updatedAt,
      product: cleanProduct(reqItem.productId),
      buyer: reqItem.buyerId,
      sellers:
        reqItem.sellers?.map(s => ({
          seller: s.sellerId,
          budgetAmount: s.budgetAmount,
          date: formatDate(s.createdAt || reqItem.createdAt),
        })) || [],
    }));

    return ApiResponse.successResponse(res, 200, 'Buyer requirements fetched successfully', {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data: result,
    });
  } catch (err) {
    console.error(err);
    return ApiResponse.errorResponse(res, 500, err.message || 'Failed to fetch buyer requirements');
  }
};

// export const getApprovedPendingRequirements = async (req, res) => {
//   try {
//     const sellerId = req.user?.userId;

//     if (!sellerId) {
//       return ApiResponse.errorResponse(res, 400, 'User not authenticated');
//     }

//     // ✅ Pagination
//     const page = parseInt(req.query.page) || 1;
//     const limit = parseInt(req.query.limit) || 10;
//     const skip = (page - 1) * limit;

//     // ✅ Fetch approved requirements
//     const approvedRequirements = await approveRequirementSchema
//       .find({
//         'sellerDetails.sellerId': sellerId,
//       })
//       .populate({
//         path: 'productId',
//         populate: { path: 'categoryId', select: '-subCategories' },
//       })
//       .populate({
//         path: 'sellerDetails.sellerId',
//         select: '-password -__v',
//       })
//       .lean();

//     // ✅ Get productIds
//     const productIds = approvedRequirements.map(ar => ar.productId?._id).filter(Boolean);

//     // ✅ Get closed deals
//     const closedDeals = await closeDealSchema
//       .find({
//         sellerId,
//         productId: { $in: productIds },
//       })
//       .select('productId dealStatus closedDealStatus finalBudget buyerId')
//       .lean();

//     // ✅ Create deal map
//     const dealMap = {};
//     closedDeals.forEach(deal => {
//       const key = `${deal.productId.toString()}_${deal.buyerId.toString()}`;
//       dealMap[key] = deal;
//     });

//     // ✅ Clean product
//     const cleanProduct = prod => {
//       if (!prod) return null;

//       const p = { ...prod };

//       if (p.userId?._id) p.userId = p.userId._id.toString();
//       if (p.subCategoryId?._id) p.subCategoryId = p.subCategoryId._id;

//       delete p.__v;

//       return {
//         ...p,
//         subProducts: [], // keep consistent
//       };
//     };

//     // ✅ Process data (NO multi-product)
//     const enhancedRequirements = approvedRequirements.map(ar => {
//       const product = cleanProduct(ar.productId);

//       const dealKey =
//         product && ar.buyerId ? `${product._id.toString()}_${ar.buyerId.toString()}` : null;

//       const matchedDeal = dealKey ? dealMap[dealKey] : null;

//       return {
//         _id: ar._id,
//         createdAt: ar.createdAt,
//         updatedAt: ar.updatedAt,
//         product,
//         buyer: ar.buyerId,
//         sellerDetails: ar.sellerDetails,
//         productCategory: ar.productCategory,
//         minBudget: ar.minBudget,
//         budget: ar.budget,
//         date: ar.date,

//         // ✅ deal info
//         dealStatus: matchedDeal?.dealStatus || 'pending',
//         closedDealStatus: matchedDeal?.closedDealStatus || null,
//         finalBudget: matchedDeal?.finalBudget || null,
//       };
//     });

//     // ✅ Filter statuses
//     const filteredRequirements = enhancedRequirements.filter(item =>
//       ['waiting_seller_approval', 'pending', 'rejected', 'completed'].includes(
//         item?.closedDealStatus
//       )
//     );

//     // ✅ Pagination (after filter)
//     const total = filteredRequirements.length;
//     const paginatedRequirements = filteredRequirements.slice(skip, skip + limit);

//     return ApiResponse.successResponse(res, 200, 'Approved requirements fetched successfully', {
//       total,
//       page,
//       limit,
//       totalPages: Math.ceil(total / limit),
//       data: paginatedRequirements,
//     });
//   } catch (err) {
//     console.error(err);
//     return ApiResponse.errorResponse(
//       res,
//       500,
//       err.message || 'Failed to fetch approved requirements'
//     );
//   }
// };

// export const getCompletedApprovedRequirements = async (req, res) => {
//   try {
//     const userId = req.user?.userId;

//     if (!userId) {
//       return ApiResponse.errorResponse(res, 400, 'User not authenticated');
//     }

//     // ✅ Pagination
//     const page = parseInt(req.query.page) || 1;
//     const limit = parseInt(req.query.limit) || 10;
//     const skip = (page - 1) * limit;

//     // ✅ Fetch closed deals
//     const [closedDeals, total] = await Promise.all([
//       closeDealSchema
//         .find({ buyerId: userId }) // or $or if needed
//         .populate({
//           path: 'productId',
//           populate: { path: 'categoryId', select: '-subCategories' },
//         })
//         .populate('buyerId')
//         .populate({
//           path: 'sellerId',
//           select: '-password -__v',
//         })
//         .sort({ createdAt: -1 })
//         .skip(skip)
//         .limit(limit)
//         .lean(),

//       closeDealSchema.countDocuments({ buyerId: userId }),
//     ]);

//     // ✅ Clean product
//     const cleanProduct = prod => {
//       if (!prod) return null;

//       const p = { ...prod };

//       if (p.userId?._id) p.userId = p.userId._id.toString();
//       if (p.subCategoryId?._id) p.subCategoryId = p.subCategoryId._id;

//       delete p.__v;

//       return {
//         ...p,
//         subProducts: [], // keep consistent structure
//       };
//     };

//     // ✅ Map response (NO multi-product)
//     const result = closedDeals.map(deal => ({
//       _id: deal._id,
//       createdAt: deal.createdAt,
//       updatedAt: deal.updatedAt,
//       product: cleanProduct(deal.productId),
//       buyer: deal.buyerId,
//       seller: deal.sellerId,
//       budgetAmount: deal.budgetAmount,
//       date: deal.date,
//       finalBudget: deal.finalBudget || 0,
//       closedAt: deal.closedAt,
//       closedDealStatus: deal.closedDealStatus,
//     }));

//     return ApiResponse.successResponse(res, 200, 'Completed closed deals fetched successfully', {
//       total,
//       page,
//       limit,
//       totalPages: Math.ceil(total / limit),
//       data: result,
//     });
//   } catch (err) {
//     console.error(err);
//     return ApiResponse.errorResponse(
//       res,
//       500,
//       err.message || 'Failed to fetch completed closed deals'
//     );
//   }
// };

export const getRequirementById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return ApiResponse.errorResponse(res, 400, 'Invalid requirement ID');
    }

    if (!userId) {
      return ApiResponse.errorResponse(res, 400, 'User not authenticated');
    }

    const requirement = await requirementSchema
      .findById(id)
      .populate({
        path: 'productId',
        populate: { path: 'categoryId', select: '-subCategories' },
      })
      .populate('buyerId')
      .populate({
        path: 'sellers.sellerId',
        select: '-password -__v',
      })
      .populate({
        path: 'sellers.bidId',
        select: 'quoteStatus budgetQuation',
      })
      .lean();

    if (!requirement) {
      return ApiResponse.errorResponse(res, 404, 'Requirement not found');
    }

    const isBuyer = requirement.buyerId._id.toString() === userId;
    const isSeller = requirement.sellers.some(s => s.sellerId._id.toString() === userId);

    if (!isBuyer && !isSeller) {
      return ApiResponse.errorResponse(res, 403, 'Access denied');
    }

    const cleanProduct = prod => {
      if (!prod) return prod;
      const p = { ...prod };

      if (p.userId?._id) p.userId = p.userId._id.toString();
      if (p.subCategoryId?._id) p.subCategoryId = p.subCategoryId._id;

      delete p.__v;
      return p;
    };

    const formatDate = date => {
      if (!date) return null;
      const d = new Date(date);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        '0'
      )}-${String(d.getDate()).padStart(2, '0')}`;
    };

    // Only the buyer manages quotes here, so only the buyer gets every
    // seller's entry. A seller who is a party to this requirement (isSeller
    // above) may load the page, but must see nothing beyond their own quote —
    // otherwise they'd see every competing seller's identity/price/status.
    const visibleSellers = isBuyer
      ? requirement.sellers
      : requirement.sellers.filter(s => s.sellerId._id.toString() === userId);

    const responseObj = {
      _id: requirement._id,
      status: requirement.status,
      createdAt: requirement.createdAt,
      updatedAt: requirement.updatedAt,
      product: requirement.productId ? cleanProduct(requirement.productId) : null,
      buyer: requirement.buyerId,
      sellers:
        visibleSellers?.map(s => ({
          seller: s.sellerId,
          // Fall back to the bid's amount when the subdoc copy is missing/zero.
          budgetAmount: s.budgetAmount || s.bidId?.budgetQuation || 0,
          // bidId + quoteStatus are required by the buyer's quote actions and tabs.
          bidId: s.bidId?._id || s.bidId || null,
          quoteStatus: s.bidId?.quoteStatus || 'pending',
          date: formatDate(s.createdAt || requirement.createdAt),
        })) || [],
    };

    return ApiResponse.successResponse(res, 200, 'Requirement fetched successfully', responseObj);
  } catch (err) {
    console.error(err);
    return ApiResponse.errorResponse(res, 500, err.message || 'Failed to fetch requirement');
  }
};

export const getRequirementAwarded = async (req, res) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return ApiResponse.errorResponse(res, 400, 'User not authenticated');
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    let closedDeals = await closeDealSchema
      .find({
        $or: [{ buyerId: userId }, { sellerId: userId }],
        closedDealStatus: 'completed',
        dealStatus: 'accepted',
      })
      .populate({
        path: 'productId',
        populate: {
          path: 'categoryId',
          select: '-subCategories',
        },
      })
      .populate('sellerId', '-password -__v')
      .sort({ createdAt: -1 })
      .lean();

    closedDeals = closedDeals.filter(deal => deal.productId.userId == userId);
    const filteredDeals = closedDeals.filter(deal => deal.productId);

    const cleanProduct = prod => {
      if (!prod) return prod;
      const p = { ...prod };
      if (p.userId?._id) p.userId = p.userId._id.toString();
      delete p.__v;
      return p;
    };

    const formattedDeals = filteredDeals.map(deal => ({
      _id: deal._id,
      product: cleanProduct(deal.productId),
      seller: deal.sellerId,
      yourBudget: deal.yourBudget,
      amount: deal.amount,
      finalBudget: deal.finalBudget,
      dealStatus: deal.dealStatus,
      closedDealStatus: deal.closedDealStatus,
      createdAt: deal.createdAt,
      updatedAt: deal.updatedAt,
      closedAt: deal.closedAt,
    }));

    const total = formattedDeals.length;
    const paginatedData = formattedDeals.slice(skip, skip + limit);

    return ApiResponse.successResponse(res, 200, 'Awarded requirements fetched successfully', {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data: paginatedData,
    });
  } catch (err) {
    console.error(err);
    return ApiResponse.errorResponse(
      res,
      500,
      err.message || 'Failed to fetch awarded requirements'
    );
  }
};

export const getDealAwarded = async (req, res) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return ApiResponse.errorResponse(res, 400, 'User not authenticated');
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const closedDeals = await closeDealSchema
      .find({
        sellerId: userId,
        closedDealStatus: 'completed',
        dealStatus: 'accepted',
      })
      .populate({
        path: 'productId',
        populate: { path: 'categoryId', select: '-subCategories' },
      })
      .populate('buyerId', '-password -__v')
      .populate('sellerId', '-password -__v')
      .sort({ createdAt: -1 })
      .lean();

    // ✅ Helper to clean product
    const cleanProduct = prod => {
      if (!prod) return prod;
      const p = { ...prod };
      if (p.userId?._id) p.userId = p.userId._id.toString();
      if (p.subCategoryId?._id) p.subCategoryId = p.subCategoryId._id;
      delete p.__v;
      return p;
    };

    const formattedDeals = closedDeals.map(deal => ({
      _id: deal._id,
      product: cleanProduct(deal.productId),
      buyer: deal.buyerId,
      seller: deal.sellerId,
      yourBudget: deal.yourBudget,
      amount: deal.amount,
      finalBudget: deal.finalBudget,
      dealStatus: deal.dealStatus,
      closedDealStatus: deal.closedDealStatus,
      createdAt: deal.createdAt,
      updatedAt: deal.updatedAt,
      closedAt: deal.closedAt,
    }));

    const total = formattedDeals.length;
    const paginatedDeals = formattedDeals.slice(skip, skip + limit);

    return ApiResponse.successResponse(res, 200, 'Seller awarded deals fetched successfully', {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data: paginatedDeals,
    });
  } catch (err) {
    console.error(err);
    return ApiResponse.errorResponse(
      res,
      500,
      err.message || 'Failed to fetch seller awarded deals'
    );
  }
};

export const getRequirementId = async (req, res) => {
  const { productId } = req.params;
  try {
    const requirement = await requirementSchema.exists({ productId });
    if (!requirement) {
      return ApiResponse.errorResponse(res, 404, 'Requirement not found');
    }
    return ApiResponse.successResponse(res, 200, 'Requirement found', requirement?._id);
  } catch (error) {
    return ApiResponse.errorResponse(res, 500, 'Error fetching requirement', error);
  }
};

import mongoose from 'mongoose';
import { ApiResponse } from '../../helpers/ApiReponse.js';
import bidSchema from '../../models/bid.schema.js';
export const adminGetBidListing = async (req, res) => {
  try {
    let { page = 1, limit = 10, text = null } = req.query;

    page = parseInt(page);
    limit = parseInt(limit);
    const skip = (page - 1) * limit;
    const matchQuery = {};
    if (text && text.trim() !== '') {
      matchQuery['$or'] = [
        { 'product.title': { $regex: text, $options: 'i' } },
        { 'product.brand': { $regex: text, $options: 'i' } },
        { 'buyerId.firstName': { $regex: text, $options: 'i' } },
        { 'buyerId.lastName': { $regex: text, $options: 'i' } },
        { 'sellerId.firstName': { $regex: text, $options: 'i' } },
        { 'sellerId.lastName': { $regex: text, $options: 'i' } },
      ];
    }

    const pipeline = [
      {
        $lookup: {
          from: 'products',
          localField: 'productId',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: '$product' },
      {
        $lookup: {
          from: 'users',
          localField: 'sellerId',
          foreignField: '_id',
          as: 'sellerId',
        },
      },
      { $unwind: '$sellerId' },
      {
        $lookup: {
          from: 'users',
          localField: 'buyerId',
          foreignField: '_id',
          as: 'buyerId',
        },
      },
      { $unwind: '$buyerId' },
      { $match: matchQuery },
      {
        $group: {
          _id: '$product._id',
          productDetails: { $first: '$product' },
          productOnBids: { $push: '$$ROOT' },
          totalBidsPerProduct: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } },
      {
        $facet: {
          bids: [{ $skip: skip }, { $limit: limit }],
          totalCount: [{ $count: 'total' }],
        },
      },
    ];

    const [result] = await bidSchema.aggregate(pipeline);

    const bids = result?.bids || [];
    const totalBids = result?.totalCount?.[0]?.total || 0;

    return ApiResponse.successResponse(res, 200, 'Bid listing fetched successfully', {
      bids,
      page,
      totalPages: Math.ceil(totalBids / limit),
      totalBids,
    });
  } catch (err) {
    console.error(err);
    return ApiResponse.errorResponse(res, 400, 'Internal server error', err);
  }
};

export const getBidById = async (req, res) => {
  const { id } = req.params;
  try {
    let { page = 1, limit = 10, text = null } = req.query;

    page = parseInt(page);
    limit = parseInt(limit);
    const skip = (page - 1) * limit;

    const matchQuery = {
      productId: new mongoose.Types.ObjectId(id),
    };

    if (text && text.trim() !== '') {
      matchQuery['$or'] = [
        // { "productId.minimumBudget": { $regex: text, $options: "i" } },
        { 'buyerId.firstName': { $regex: text, $options: 'i' } },
        { 'buyerId.lastName': { $regex: text, $options: 'i' } },
        { 'sellerId.firstName': { $regex: text, $options: 'i' } },
        { 'sellerId.lastName': { $regex: text, $options: 'i' } },
      ];
    }

    const pipeline = [
      {
        $lookup: {
          from: 'products',
          localField: 'productId',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: '$product' },
      {
        $lookup: {
          from: 'users',
          localField: 'sellerId',
          foreignField: '_id',
          as: 'sellerId',
        },
      },
      { $unwind: '$sellerId' },
      {
        $lookup: {
          from: 'users',
          localField: 'buyerId',
          foreignField: '_id',
          as: 'buyerId',
        },
      },
      { $unwind: '$buyerId' },

      { $match: matchQuery },
      {
        $group: {
          _id: '$product._id',
          productDetails: { $first: '$product' },
          productOnBids: { $push: '$$ROOT' },
          totalBidsPerProduct: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'categories',
          localField: 'productDetails.categoryId',
          foreignField: '_id',
          as: 'categoryData',
        },
      },
      {
        $unwind: {
          path: '$categoryData',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          'productDetails.categoryId': '$categoryData',
        },
      },

      {
        $addFields: {
          'productDetails.subCategoryId': {
            $filter: {
              input: '$productDetails.categoryId.subCategories',
              as: 'category',
              cond: {
                $eq: [{ $toObjectId: '$$category._id' }, { $toObjectId: '$categoryId._id' }],
              },
            },
          },
        },
      },
      {
        $addFields: {
          'productDetails.subCategoryId': {
            $arrayElemAt: ['$productDetails.categoryId.subCategories', 0],
          },
        },
      },
      {
        $unset: 'productDetails.categoryId.subCategories',
      },
      {
        $facet: {
          bids: [{ $sort: { _id: -1 } }, { $skip: skip }, { $limit: limit }],
          totalCount: [{ $count: 'count' }],
        },
      },
    ];

    const result = await bidSchema.aggregate(pipeline);
    const bids = result[0]?.bids || [];
    const totalCount = result[0]?.totalCount?.[0]?.count || 0;

    return ApiResponse.successResponse(res, 200, 'Bid listing fetched successfully', {
      bids: bids.length ? bids[0] : null,
      page,
      totalPages: Math.ceil(totalCount / limit),
      totalBids: totalCount,
    });
  } catch (err) {
    console.error(err);
    return ApiResponse.errorResponse(res, 400, 'Internal server error', err);
  }
};

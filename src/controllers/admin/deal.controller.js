import { ApiResponse } from '../../helpers/ApiReponse.js';
import closeDealSchema from '../../models/closeDeal.schema.js';

export const adminGetDeals = async (req, res) => {
  try {
    let { page = 1, limit = 10, status = null, text = null } = req.query;
    page = parseInt(page);
    limit = parseInt(limit);
    const skip = (page - 1) * limit;

    const matchQuery = {};
    if (status && status !== 'all') {
      matchQuery.closedDealStatus = status;
    }
    if (text && text.trim() !== '') {
      matchQuery['$or'] = [
        { 'buyer.firstName': { $regex: text, $options: 'i' } },
        { 'buyer.lastName': { $regex: text, $options: 'i' } },
        { 'seller.firstName': { $regex: text, $options: 'i' } },
        { 'seller.lastName': { $regex: text, $options: 'i' } },
        { 'product.title': { $regex: text, $options: 'i' } },
      ];
    }

    const pipeline = [
      {
        $lookup: {
          from: 'users',
          localField: 'buyerId',
          foreignField: '_id',
          as: 'buyer',
        },
      },
      { $unwind: { path: '$buyer', preserveNullAndEmpty: false } },
      {
        $lookup: {
          from: 'users',
          localField: 'sellerId',
          foreignField: '_id',
          as: 'seller',
        },
      },
      { $unwind: { path: '$seller', preserveNullAndEmpty: false } },
      {
        $lookup: {
          from: 'products',
          localField: 'productId',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: { path: '$product', preserveNullAndEmpty: false } },
      { $match: matchQuery },
      {
        $project: {
          _id: 1,
          closedDealStatus: 1,
          dealStatus: 1,
          amount: 1,
          yourBudget: 1,
          sellerRating: 1,
          createdAt: 1,
          'buyer._id': 1,
          'buyer.firstName': 1,
          'buyer.lastName': 1,
          'buyer.phone': 1,
          'seller._id': 1,
          'seller.firstName': 1,
          'seller.lastName': 1,
          'seller.phone': 1,
          'product._id': 1,
          'product.title': 1,
          'product.images': 1,
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          total: [{ $count: 'count' }],
        },
      },
    ];

    const result = await closeDealSchema.aggregate(pipeline);
    const deals = result[0]?.data || [];
    const total = result[0]?.total[0]?.count || 0;

    return ApiResponse.successResponse(res, 200, 'Deals fetched', {
      deals,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error(error);
    return ApiResponse.errorResponse(res, 500, 'Error fetching deals');
  }
};

export const adminUpdateDealStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { closedDealStatus } = req.body;
    const allowed = ['pending', 'waiting_seller_approval', 'completed', 'rejected'];
    if (!allowed.includes(closedDealStatus)) {
      return ApiResponse.errorResponse(res, 400, 'Invalid status');
    }
    const deal = await closeDealSchema.findByIdAndUpdate(
      id,
      { closedDealStatus },
      { new: true }
    );
    if (!deal) return ApiResponse.errorResponse(res, 404, 'Deal not found');
    return ApiResponse.successResponse(res, 200, 'Deal status updated', deal);
  } catch (error) {
    return ApiResponse.errorResponse(res, 500, 'Error updating deal');
  }
};

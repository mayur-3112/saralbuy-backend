import { ApiResponse } from '../../helpers/ApiReponse.js';
import productSchema from '../../models/product.schema.js';

export const adminGetRfqList = async (req, res) => {
  try {
    let { page = 1, limit = 10, status = 'all', text = null } = req.query;
    page = parseInt(page);
    limit = parseInt(limit);
    const skip = (page - 1) * limit;

    const matchQuery = { draft: { $ne: true } };
    if (status && status !== 'all') matchQuery.moderationStatus = status;
    if (text && text.trim() !== '') {
      matchQuery['$or'] = [
        { title: { $regex: text, $options: 'i' } },
        { brand: { $regex: text, $options: 'i' } },
        { 'user.firstName': { $regex: text, $options: 'i' } },
        { 'user.lastName': { $regex: text, $options: 'i' } },
      ];
    }

    const pipeline = [
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: { path: '$user', preserveNullAndEmpty: false } },
      {
        $lookup: {
          from: 'categories',
          localField: 'categoryId',
          foreignField: '_id',
          as: 'category',
        },
      },
      { $unwind: { path: '$category', preserveNullAndEmpty: true } },
      { $match: matchQuery },
      {
        $project: {
          _id: 1,
          title: 1,
          brand: 1,
          quantity: 1,
          quantityUnit: 1,
          minimumBudget: 1,
          image: 1,
          document: 1,
          moderationStatus: 1,
          moderationNote: 1,
          totalBidCount: 1,
          bidExpiryDate: 1,
          createdAt: 1,
          'user._id': 1,
          'user.firstName': 1,
          'user.lastName': 1,
          'user.phone': 1,
          'category.categoryName': 1,
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          total: [{ $count: 'count' }],
          statusCounts: [
            {
              $group: {
                _id: '$moderationStatus',
                count: { $sum: 1 },
              },
            },
          ],
        },
      },
    ];

    const result = await productSchema.aggregate(pipeline);
    const rfqs = result[0]?.data || [];
    const total = result[0]?.total[0]?.count || 0;
    const statusCounts = result[0]?.statusCounts || [];

    return ApiResponse.successResponse(res, 200, 'RFQs fetched', {
      rfqs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      statusCounts,
    });
  } catch (error) {
    console.error(error);
    return ApiResponse.errorResponse(res, 500, 'Error fetching RFQs');
  }
};

export const adminUpdateRfqModeration = async (req, res) => {
  try {
    const { id } = req.params;
    const { moderationStatus, moderationNote } = req.body;
    const allowed = ['pending', 'approved', 'rejected', 'flagged'];
    if (!allowed.includes(moderationStatus)) {
      return ApiResponse.errorResponse(res, 400, 'Invalid moderation status');
    }
    const product = await productSchema.findByIdAndUpdate(
      id,
      { moderationStatus, moderationNote: moderationNote || '' },
      { new: true }
    );
    if (!product) return ApiResponse.errorResponse(res, 404, 'RFQ not found');
    return ApiResponse.successResponse(res, 200, 'Moderation status updated', {
      _id: product._id,
      moderationStatus: product.moderationStatus,
      moderationNote: product.moderationNote,
    });
  } catch (error) {
    return ApiResponse.errorResponse(res, 500, 'Error updating moderation');
  }
};

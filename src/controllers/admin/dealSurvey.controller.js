import { ApiResponse } from '../../helpers/ApiReponse.js';
import dealSurveySchema from '../../models/dealSurvey.schema.js';

export const adminGetSurveys = async (req, res) => {
  try {
    let { page = 1, limit = 10, role = 'all', text = null } = req.query;
    page = parseInt(page);
    limit = parseInt(limit);
    const skip = (page - 1) * limit;

    const matchQuery = {};
    if (role && role !== 'all') matchQuery.role = role;

    const pipeline = [
      { $match: matchQuery },
      {
        $lookup: {
          from: 'closeddeals',
          localField: 'dealId',
          foreignField: '_id',
          as: 'deal',
        },
      },
      { $unwind: { path: '$deal', preserveNullAndEmpty: true } },
      {
        $lookup: {
          from: 'users',
          localField: 'submittedBy',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: { path: '$user', preserveNullAndEmpty: true } },
      {
        $lookup: {
          from: 'products',
          localField: 'deal.productId',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: { path: '$product', preserveNullAndEmpty: true } },
      ...(text && text.trim()
        ? [{
            $match: {
              $or: [
                { 'user.firstName': { $regex: text, $options: 'i' } },
                { 'user.lastName': { $regex: text, $options: 'i' } },
                { 'product.title': { $regex: text, $options: 'i' } },
                { review: { $regex: text, $options: 'i' } },
              ],
            },
          }]
        : []),
      {
        $project: {
          role: 1,
          overallRating: 1,
          communicationRating: 1,
          accuracyRating: 1,
          deliveryRating: 1,
          valueRating: 1,
          review: 1,
          wouldRecommend: 1,
          createdAt: 1,
          'user._id': 1,
          'user.firstName': 1,
          'user.lastName': 1,
          'user.phone': 1,
          'product._id': 1,
          'product.title': 1,
          'product.image': 1,
          'deal._id': 1,
          'deal.amount': 1,
          'deal.closedDealStatus': 1,
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          total: [{ $count: 'count' }],
          avgStats: [
            {
              $group: {
                _id: null,
                avgOverall: { $avg: '$overallRating' },
                avgComm: { $avg: '$communicationRating' },
                avgAccuracy: { $avg: '$accuracyRating' },
                avgDelivery: { $avg: '$deliveryRating' },
                avgValue: { $avg: '$valueRating' },
                recommendCount: { $sum: { $cond: ['$wouldRecommend', 1, 0] } },
                totalCount: { $sum: 1 },
              },
            },
          ],
          ratingDist: [
            { $group: { _id: '$overallRating', count: { $sum: 1 } } },
            { $sort: { _id: 1 } },
          ],
        },
      },
    ];

    const result = await dealSurveySchema.aggregate(pipeline);
    const surveys = result[0]?.data || [];
    const total = result[0]?.total[0]?.count || 0;
    const avgStats = result[0]?.avgStats[0] || null;
    const ratingDist = result[0]?.ratingDist || [];

    return ApiResponse.successResponse(res, 200, 'Surveys fetched', {
      surveys,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      avgStats,
      ratingDist,
    });
  } catch (error) {
    console.error(error);
    return ApiResponse.errorResponse(res, 500, 'Error fetching surveys');
  }
};

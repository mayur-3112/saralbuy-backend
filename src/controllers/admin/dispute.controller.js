import { ApiResponse } from '../../helpers/ApiReponse.js';
import reportSchema from '../../models/report.schema.js';
import userSchema from '../../models/user.schema.js';

export const adminGetReports = async (req, res) => {
  try {
    let { page = 1, limit = 10, status = 'open', type = 'all', text = null } = req.query;
    page = parseInt(page);
    limit = parseInt(limit);
    const skip = (page - 1) * limit;

    const matchQuery = {};
    if (status && status !== 'all') matchQuery.status = status;
    if (type && type !== 'all') matchQuery.reportType = type;

    const pipeline = [
      { $match: matchQuery },
      {
        $lookup: {
          from: 'users',
          localField: 'reportedBy',
          foreignField: '_id',
          as: 'reporter',
        },
      },
      { $unwind: { path: '$reporter', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'users',
          localField: 'reportedUser',
          foreignField: '_id',
          as: 'targetUser',
        },
      },
      { $unwind: { path: '$targetUser', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'products',
          localField: 'reportedProduct',
          foreignField: '_id',
          as: 'targetProduct',
        },
      },
      { $unwind: { path: '$targetProduct', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'bids',
          localField: 'reportedBid',
          foreignField: '_id',
          as: 'targetBid',
        },
      },
      { $unwind: { path: '$targetBid', preserveNullAndEmptyArrays: true } },
      ...(text && text.trim()
        ? [
            {
              $match: {
                $or: [
                  { 'reporter.firstName': { $regex: text, $options: 'i' } },
                  { 'reporter.lastName': { $regex: text, $options: 'i' } },
                  { 'targetUser.firstName': { $regex: text, $options: 'i' } },
                  { 'targetProduct.title': { $regex: text, $options: 'i' } },
                  { description: { $regex: text, $options: 'i' } },
                ],
              },
            },
          ]
        : []),
      {
        $project: {
          reportType: 1,
          description: 1,
          status: 1,
          adminNote: 1,
          actionTaken: 1,
          resolvedAt: 1,
          createdAt: 1,
          'reporter._id': 1,
          'reporter.firstName': 1,
          'reporter.lastName': 1,
          'reporter.phone': 1,
          'targetUser._id': 1,
          'targetUser.firstName': 1,
          'targetUser.lastName': 1,
          'targetUser.phone': 1,
          'targetUser.status': 1,
          'targetProduct._id': 1,
          'targetProduct.title': 1,
          'targetBid._id': 1,
          'targetBid.budgetQuation': 1,
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          total: [{ $count: 'count' }],
          statusCounts: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
        },
      },
    ];

    const result = await reportSchema.aggregate(pipeline);
    return ApiResponse.successResponse(res, 200, 'Reports fetched', {
      reports: result[0]?.data || [],
      total: result[0]?.total[0]?.count || 0,
      page,
      totalPages: Math.ceil((result[0]?.total[0]?.count || 0) / limit),
      statusCounts: result[0]?.statusCounts || [],
    });
  } catch (error) {
    console.error(error);
    return ApiResponse.errorResponse(res, 500, 'Error fetching reports');
  }
};

export const adminResolveReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNote, actionTaken } = req.body;
    const allowedStatus = ['open', 'under_review', 'resolved', 'dismissed'];
    const allowedActions = ['none', 'warned', 'suspended', 'banned', 'content_removed'];
    if (!allowedStatus.includes(status)) return ApiResponse.errorResponse(res, 400, 'Invalid status');
    if (actionTaken && !allowedActions.includes(actionTaken)) return ApiResponse.errorResponse(res, 400, 'Invalid action');

    const update = {
      status,
      adminNote: adminNote || '',
      actionTaken: actionTaken || 'none',
      resolvedBy: req.admin?._id || null,
      resolvedAt: ['resolved', 'dismissed'].includes(status) ? new Date() : null,
    };

    const report = await reportSchema.findByIdAndUpdate(id, update, { new: true });
    if (!report) return ApiResponse.errorResponse(res, 404, 'Report not found');

    // If action is suspend or ban, update target user status
    if (report.reportedUser && ['suspended', 'banned'].includes(actionTaken)) {
      await userSchema.findByIdAndUpdate(report.reportedUser, { status: 'inactive' });
    }

    return ApiResponse.successResponse(res, 200, 'Report updated', report);
  } catch (error) {
    return ApiResponse.errorResponse(res, 500, 'Error resolving report');
  }
};

export const adminCreateReport = async (req, res) => {
  try {
    const { reportedBy, reportType, reportedUser, reportedProduct, reportedBid, description } = req.body;
    const report = await reportSchema.create({
      reportedBy,
      reportType,
      reportedUser: reportedUser || null,
      reportedProduct: reportedProduct || null,
      reportedBid: reportedBid || null,
      description,
    });
    return ApiResponse.successResponse(res, 201, 'Report created', report);
  } catch (error) {
    return ApiResponse.errorResponse(res, 500, 'Error creating report');
  }
};

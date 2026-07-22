import { ApiResponse } from '../../helpers/ApiReponse.js';
import userSchema from '../../models/user.schema.js';
import { applyVerificationDecision } from '../../services/verificationDecision.service.js';

export const adminGetVerificationQueue = async (req, res) => {
  try {
    let { page = 1, limit = 10, status = 'pending', text = null } = req.query;
    page = parseInt(page);
    limit = parseInt(limit);
    const skip = (page - 1) * limit;

    const matchQuery = {};
    if (status && status !== 'all') matchQuery.verificationStatus = status;
    if (text && text.trim() !== '') {
      matchQuery['$or'] = [
        { firstName: { $regex: text, $options: 'i' } },
        { lastName: { $regex: text, $options: 'i' } },
        { phone: { $regex: text, $options: 'i' } },
        { gstin: { $regex: text, $options: 'i' } },
        { businessName: { $regex: text, $options: 'i' } },
      ];
    }

    const [users, total, statusCounts] = await Promise.all([
      userSchema
        .find(matchQuery, {
          firstName: 1,
          lastName: 1,
          phone: 1,
          email: 1,
          profileImage: 1,
          businessName: 1,
          gstin: 1,
          pan: 1,
          gstinDocumentUrl: 1,
          panDocumentUrl: 1,
          verificationStatus: 1,
          verificationSubmittedAt: 1,
          verificationDecidedAt: 1,
          verificationNotes: 1,
          verificationMethod: 1,
          createdAt: 1,
        })
        .sort({ verificationSubmittedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      userSchema.countDocuments(matchQuery),
      userSchema.aggregate([
        { $group: { _id: '$verificationStatus', count: { $sum: 1 } } },
      ]),
    ]);

    return ApiResponse.successResponse(res, 200, 'Verification queue fetched', {
      users,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      statusCounts,
    });
  } catch (error) {
    console.error(error);
    return ApiResponse.errorResponse(res, 500, 'Error fetching verification queue');
  }
};

export const adminDecideVerification = async (req, res) => {
  try {
    const { id } = req.params;
    const { verificationStatus, verificationNotes } = req.body;

    // req.admin was never set by adminAuth middleware (it sets req.user) —
    // verificationDecidedBy was silently always null through this endpoint.
    const result = await applyVerificationDecision({
      userId: id,
      targetStatus: verificationStatus,
      notes: verificationNotes,
      decidedBy: req.user?.userId || req.user?._id,
    });

    const user = await userSchema
      .findById(id)
      .select('firstName lastName verificationStatus verificationNotes verificationDecidedAt');
    return ApiResponse.successResponse(res, result.statusCode, result.message, user);
  } catch (error) {
    return ApiResponse.errorResponse(res, error.statusCode || 500, error.message || 'Error updating verification');
  }
};

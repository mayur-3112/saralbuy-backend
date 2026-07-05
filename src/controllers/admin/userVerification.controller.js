import { ApiResponse } from '../../helpers/ApiReponse.js';
import userSchema from '../../models/user.schema.js';

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
    const allowed = ['verified', 'rejected', 'pending'];
    if (!allowed.includes(verificationStatus)) {
      return ApiResponse.errorResponse(res, 400, 'Invalid verification status');
    }
    const update = {
      verificationStatus,
      verificationNotes: verificationNotes || null,
      verificationDecidedAt: new Date(),
      verificationDecidedBy: req.admin?._id || null,
      verificationMethod: 'manual_admin',
    };
    const user = await userSchema.findByIdAndUpdate(id, update, { new: true }).select(
      'firstName lastName verificationStatus verificationNotes verificationDecidedAt'
    );
    if (!user) return ApiResponse.errorResponse(res, 404, 'User not found');
    return ApiResponse.successResponse(res, 200, 'Verification decision saved', user);
  } catch (error) {
    return ApiResponse.errorResponse(res, 500, 'Error updating verification');
  }
};

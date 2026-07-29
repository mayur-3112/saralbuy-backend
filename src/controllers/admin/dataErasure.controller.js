import { ApiResponse } from '../../helpers/ApiReponse.js';
import userSchema from '../../models/user.schema.js';

// Queue of users who have requested deletion but haven't been anonymized yet
// (see user.controller.js#requestAccountDeletion and the schema comment on
// deletionRequestedAt for why this is a request+fulfill flow, not instant).
export const adminGetErasureQueue = async (req, res) => {
  try {
    let { page = 1, limit = 10 } = req.query;
    page = parseInt(page);
    limit = parseInt(limit);
    const skip = (page - 1) * limit;

    const matchQuery = { deletionRequestedAt: { $ne: null }, deletionCompletedAt: null };

    const [users, total] = await Promise.all([
      userSchema
        .find(matchQuery, {
          firstName: 1,
          lastName: 1,
          phone: 1,
          email: 1,
          businessName: 1,
          deletionRequestedAt: 1,
          createdAt: 1,
        })
        .sort({ deletionRequestedAt: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      userSchema.countDocuments(matchQuery),
    ]);

    return ApiResponse.successResponse(res, 200, 'Erasure queue fetched', {
      users,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error(error);
    return ApiResponse.errorResponse(res, 500, 'Error fetching erasure queue');
  }
};

// Scrubs personal data while keeping the document (and its _id) intact, since
// other users' Bid/ClosedDeal/Chat records reference this _id and hard-deleting
// the User doc would corrupt their transaction history. Sets a unique,
// non-functional phone placeholder so the (non-unique but app-relied-on)
// phone-lookup index never collides with a real user, and clears every other
// personally-identifying field. Does not touch Chat/Bid/Requirement content —
// anonymizing the account, not rewriting marketplace history.
export const anonymizeUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await userSchema.findById(id);
    if (!user) return ApiResponse.errorResponse(res, 404, 'User not found');

    if (!user.deletionRequestedAt) {
      return ApiResponse.errorResponse(res, 400, 'User has not requested deletion');
    }
    if (user.deletionCompletedAt) {
      return ApiResponse.errorResponse(res, 400, 'User already anonymized');
    }

    user.firstName = 'Deleted';
    user.lastName = 'User';
    user.email = undefined;
    user.phone = `deleted-${user._id}`;
    user.password = undefined;
    user.address = null;
    user.profileImage = null;
    user.currentLocation = undefined;
    user.businessName = null;
    user.organizationName = null;
    user.website = null;
    user.businessDescription = null;
    user.accomplishments = null;
    user.topProblemsSolved = null;
    user.businessPhone = null;
    user.storeAddress = null;
    user.gstin = null;
    user.pan = null;
    user.gstinDocumentUrl = null;
    user.panDocumentUrl = null;
    user.status = 'inactive';
    user.deletionCompletedAt = new Date();

    await user.save();

    return ApiResponse.successResponse(res, 200, 'User anonymized', {
      _id: user._id,
      deletionCompletedAt: user.deletionCompletedAt,
    });
  } catch (error) {
    console.error('anonymizeUser error:', error);
    return ApiResponse.errorResponse(res, 500, error.message || 'Error anonymizing user');
  }
};

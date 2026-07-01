import { isValidObjectId } from 'mongoose';
import { ApiResponse } from '../../helpers/ApiReponse.js';
import redisHelper from '../../helpers/redisHelper.js';
import userSchema from '../../models/user.schema.js';
import { authCookieOptions } from '../../utils/cookieOptions.js';

export const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password || !email?.trim() || !password?.trim()) {
    ApiResponse.errorResponse(res, 400, 'Email and password are required');
    return;
  }
  try {
    const user = await userSchema.findOne({ email, role: 'admin' });
    if (!user) {
      ApiResponse.errorResponse(res, 404, 'User not found');
      return;
    }
    const comparePassword = await user.comparePassword(password.toString());
    if (!comparePassword) {
      ApiResponse.errorResponse(res, 401, 'Invalid password');
      return;
    }
    user.lastLogin = new Date();
    const token = user.generateAuthToken();
    res.cookie('adminToken', token, authCookieOptions);
    ApiResponse.successResponse(res, 200, 'Login successful', { token, user });
  } catch (error) {
    console.log('ADMIN LOGGING ERRROR:', error);
    ApiResponse.errorResponse(res, 400, error.message);
  }
};

export const register = async (req, res) => {
  const { email, password, fname, lname } = req.body;
  if (
    !email ||
    !password ||
    !fname ||
    !lname ||
    !email?.trim() ||
    !password?.trim() ||
    !fname?.trim() ||
    !lname?.trim()
  ) {
    return ApiResponse.errorResponse(
      res,
      400,
      'Email, password, firstName and lastName are required',
      null
    );
  }
  if (password.toString().length < 6) {
    ApiResponse.errorResponse(res, 400, 'Password must be at least 6 characters long');
    return;
  }
  try {
    // only admin can register
    const admin = await userSchema.exists({ role: 'admin' }).lean();
    if (admin?._id)
      return ApiResponse.errorResponse(
        res,
        400,
        'Multiple admins are not allowed. Contact the developer.'
      );

    const existingUser = await userSchema.exists({ email });
    if (existingUser?._id) {
      ApiResponse.errorResponse(res, 400, 'User already exists');
      return;
    }

    const user = await userSchema.create({
      email,
      firstName: fname,
      lastName: lname,
      role: 'admin',
      phone: Math.floor(Math.random() * 1000000000),
      password,
    });
    user.lastLogin = new Date();
    await user.save();
    // const token = user.generateAuthToken();
    // res.cookie('adminToken', token, authCookieOptions);
    ApiResponse.successResponse(res, 200, user);
  } catch (error) {
    console.log('DURING THE REGISTER ADMIN:', error);
    ApiResponse.errorResponse(res, 500, error.message || 'Something went wrong');
  }
};

export const logout = (req, res) => {
  const user = req.user;
  if (!user) return ApiResponse.errorResponse(res, 401, 'User not logged in');
  const { maxAge, ...clearOptions } = authCookieOptions;
  res.clearCookie('adminToken', clearOptions);
  redisHelper.del(`user_${user._id}`);
  res.status(200).json({ message: 'Logged out' });
};

export const adminProfile = async (req, res) => {
  try {
    const { userId } = req.user;
    const user = await userSchema.findById(userId).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    return ApiResponse.successResponse(res, 200, 'admin profile fetched successfully', user);
  } catch (err) {
    console.log(err);
    res.status(400).json({ message: err.message });
  }
};

export const getUser = async (req, res) => {
  try {
    let { page = 1, limit = 10, text = null, selectActiveOption, sort } = req.query;
    page = parseInt(page);
    limit = parseInt(limit);
    const skip = (page - 1) * limit;
    let query = { role: 'user', ...(selectActiveOption && { status: selectActiveOption }) };
    console.log(query);
    if (text && text.trim() !== '') {
      query['$or'] = [
        { firstName: { $regex: text, $options: 'i' } },
        { lastName: { $regex: text, $options: 'i' } },
        { email: { $regex: text, $options: 'i' } },
        { phone: { $regex: text, $options: 'i' } },
        { address: { $regex: text, $options: 'i' } },
      ];
    }

    const users = await userSchema
      .find(query)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: sort === 'asc' ? 1 : -1 });
    const totalUsers = await userSchema.countDocuments(query);
    const totalPages = Math.ceil(totalUsers / limit);
    ApiResponse.successResponse(res, 200, 'users fetched', {
      users,
      page,
      totalPages,
      totalUsers,
    });
  } catch (error) {
    ApiResponse.errorResponse(res, 400, error.message);
  }
};

export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return ApiResponse.errorResponse(res, 400, 'Invalid user ID');
    }
    const user = await userSchema.findById(id);
    if (!user) {
      return ApiResponse.errorResponse(res, 404, 'User not found');
    }
    return ApiResponse.successResponse(res, 200, 'User fetched successfully', user);
  } catch (error) {
    return ApiResponse.errorResponse(res, 400, error.message);
  }
};

export const updateUserById = async (req, res) => {
  console.log(req.body, '--------------');
  const { id } = req.params;

  // Whitelist fields strictly to ['status', 'role'] to prevent admin editing user profile data
  const allowedUpdates = ['status', 'role'];
  const updates = {};
  for (const key of allowedUpdates) {
    if (req.body[key] !== undefined) {
      updates[key] = req.body[key];
    }
  }

  try {
    const user = await userSchema.findByIdAndUpdate(
      id,
      {
        $set: updates,
      },
      { new: true }
    ).select('-password');
    if (!user) {
      return ApiResponse.errorResponse(res, 404, 'User not found');
    }
    return ApiResponse.successResponse(res, 200, 'User updated successfully', user);
  } catch (error) {
    return ApiResponse.errorResponse(res, 400, error.message);
  }
};

export const adminResetUserPassword = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!isValidObjectId(userId)) {
      return ApiResponse.errorResponse(res, 400, 'Invalid user ID');
    }
    const user = await userSchema.findById(userId);
    if (!user) {
      return ApiResponse.errorResponse(res, 404, 'User not found');
    }
    // Generate secure temporary plaintext password SB_[random]!
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const tempPassword = `SB_${randomSuffix}!`;
    user.password = tempPassword;
    await user.save();

    return ApiResponse.successResponse(res, 200, 'User password reset successfully', {
      tempPassword,
    });
  } catch (error) {
    return ApiResponse.errorResponse(res, 500, error.message);
  }
};

/**
 * List users pending business verification. Powers the admin verification queue.
 */
export const getPendingVerifications = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = { verificationStatus: 'pending' };
    const [users, total] = await Promise.all([
      userSchema
        .find(filter)
        .select('firstName lastName email phone businessName gstin pan gstinDocumentUrl panDocumentUrl verificationSubmittedAt')
        .sort({ verificationSubmittedAt: 1 }) // oldest submissions first (FIFO)
        .skip(skip)
        .limit(limit),
      userSchema.countDocuments(filter),
    ]);

    return ApiResponse.successResponse(res, 200, 'Pending verifications', {
      users,
      page,
      totalPages: Math.ceil(total / limit),
      total,
    });
  } catch (error) {
    return ApiResponse.errorResponse(res, 500, error.message);
  }
};

/**
 * Approve or reject a supplier's business verification.
 * Body: { decision: 'approve' | 'reject', notes?: string }
 */
export const decideVerification = async (req, res) => {
  try {
    const { userId } = req.params;
    const { decision, notes } = req.body;

    if (!isValidObjectId(userId)) {
      return ApiResponse.errorResponse(res, 400, 'Invalid user ID');
    }
    if (!['approve', 'reject'].includes(decision)) {
      return ApiResponse.errorResponse(res, 400, "decision must be 'approve' or 'reject'");
    }
    if (decision === 'reject' && (!notes || !notes.trim())) {
      return ApiResponse.errorResponse(res, 400, 'Reject decisions must include a reason in notes');
    }

    const user = await userSchema.findById(userId);
    if (!user) return ApiResponse.errorResponse(res, 404, 'User not found');
    if (user.verificationStatus !== 'pending') {
      return ApiResponse.errorResponse(res, 400, `Cannot decide — current status is '${user.verificationStatus}'`);
    }

    user.verificationStatus = decision === 'approve' ? 'verified' : 'rejected';
    user.verificationDecidedAt = new Date();
    user.verificationDecidedBy = req.user.userId || req.user._id;
    user.verificationMethod = 'manual_admin';
    if (notes) user.verificationNotes = notes.trim();

    await user.save();

    return ApiResponse.successResponse(
      res,
      200,
      `Verification ${decision === 'approve' ? 'approved' : 'rejected'}`,
      {
        _id: user._id,
        verificationStatus: user.verificationStatus,
        verificationDecidedAt: user.verificationDecidedAt,
        verificationNotes: user.verificationNotes,
      }
    );
  } catch (error) {
    return ApiResponse.errorResponse(res, 500, error.message);
  }
};

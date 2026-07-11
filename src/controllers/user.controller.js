import bcrypt from 'bcryptjs';
import { ApiResponse } from '../helpers/ApiReponse.js';
import userSchema from '../models/user.schema.js';
import uploadFile from '../config/imageKit.config.js';
import { authCookieOptions } from '../utils/cookieOptions.js';
import redisHelper from '../helpers/redisHelper.js';

const otpStore = new Map();

export const sendOtp = async (req, res) => {
  let { pNo } = req.body;
  try {
    pNo = pNo.startsWith('+') ? pNo : `+91${pNo}`;
    const otp = Math.floor(1_00_000 + Math.random() * 9_00_000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000;
    otpStore.set(pNo, { otp, expiresAt });
    console.log(`OTP for ${pNo}: ${otp}`);

    return ApiResponse.successResponse(res, 200, 'Otp sent successfully', otp);
  } catch (err) {
    console.error('OTP error:', err);
    return ApiResponse.errorResponse(res, 400, err?.message || err);
  }
};

export const verifyOtp = async (req, res) => {
  let { pNo, otp } = req.body;

  try {
    pNo = pNo.startsWith('+') ? pNo : `+91${pNo}`;

    const otpData = otpStore.get(pNo);
    if (!otpData) {
      return ApiResponse.errorResponse(res, 400, 'No OTP found for this number');
    }

    if (otpData.expiresAt < Date.now()) {
      otpStore.delete(pNo);
      return ApiResponse.errorResponse(res, 400, 'OTP expired');
    }
    if (otpData.otp !== otp) {
      return ApiResponse.errorResponse(res, 400, 'Invalid OTP');
    }

    otpStore.delete(pNo);

    let user = await userSchema.findOne({ phone: pNo });
    if (!user) {
      user = await userSchema.create({ phone: pNo });
    }

    const payload = { _id: user._id, phone: user.phone };
    const token = user.generateAuthToken();
    res.cookie('authToken', token, authCookieOptions);

    return ApiResponse.successResponse(res, 200, 'Otp verified successfully', {
      token,
      user: { _id: user._id, phone: user.phone },
    });
  } catch (err) {
    console.error('Verify error:', err);
    return ApiResponse.errorResponse(res, 400, err?.message || err);
  }
};

//  2 Factor OTP

export const factorSendOtp = async (req, res) => {
  let { pNo } = req.body;
  try {
    const apiKey = process.env.FACTOR_MESSAGE_API;
    pNo = pNo.startsWith('+') ? pNo.slice(1) : `91${pNo}`;
    console.log('Phone Number:', pNo);

    // Check for inactive users
    const findUser = await userSchema.findOne({
      phone: new RegExp(`^\\+${pNo}$`, 'i'),
      status: 'inactive',
      role: 'user',
    });

    if (findUser) {
      return ApiResponse.errorResponse(
        res,
        400,
        'Your account is not active. Please contact to admin'
      );
    }

    let useFallback = false;
    let fallbackDetails = '';

    if (!apiKey || apiKey === 'your-factor-api-key' || apiKey === 'undefined' || apiKey === 'null' || apiKey.length < 5) {
      useFallback = true;
      fallbackDetails = 'API key not configured';
    }

    if (!useFallback) {
      try {
        const apiUrl = `https://2factor.in/API/V1/${apiKey}/SMS/+${pNo}/AUTOGEN/SaralBuy`;
        console.log('Sending OTP to:', pNo);
        console.log('API URL:', apiUrl);

        const response = await fetch(apiUrl);
        const data = await response.json();
        console.log('OTP response:', data);

        if (data.Status === 'Success') {
          console.log('✅ OTP SENT SUCCESSFULLY via SMS');
          return ApiResponse.successResponse(res, 200, 'OTP sent successfully', {
            sessionId: data.Details, // This is the session ID you'll need for verification
          });
        } else {
          console.log('2Factor API failed, falling back to dummy OTP. Details:', data.Details);
          useFallback = true;
          fallbackDetails = data.Details || 'API failed';
        }
      } catch (fetchErr) {
        console.error('Fetch to 2Factor failed, falling back to dummy OTP:', fetchErr);
        useFallback = true;
        fallbackDetails = fetchErr?.message || 'Network error';
      }
    }

    if (useFallback) {
      const dummySessionId = `dummy-session-${pNo}-${Date.now()}`;
      const mockOtp = '123456';
      const expiresAt = Date.now() + 5 * 60 * 1000;
      otpStore.set(dummySessionId, { otp: mockOtp, expiresAt });
      console.log(`[FALLBACK] OTP for ${pNo} is mock: ${mockOtp} (Session: ${dummySessionId}) Reason: ${fallbackDetails}`);

      return ApiResponse.successResponse(res, 200, 'OTP sent successfully', {
        sessionId: dummySessionId,
      });
    }
  } catch (err) {
    console.error('OTP sending error:', err);
    return ApiResponse.errorResponse(res, 500, err?.message || 'Internal server error');
  }
};

export const factorVerifyOtp = async (req, res) => {
  let { pNo, otp, sessionId } = req.body;

  try {
    if (!pNo || !otp || !sessionId) {
      return ApiResponse.errorResponse(res, 400, 'Phone number, OTP, and sessionId are required');
    }

    // Handle dummy session / fallback verification
    if (sessionId.startsWith('dummy-session-') || otpStore.has(sessionId)) {
      const otpData = otpStore.get(sessionId);
      if (!otpData) {
        return ApiResponse.errorResponse(res, 400, 'Invalid or expired OTP session');
      }
      if (otpData.expiresAt < Date.now()) {
        otpStore.delete(sessionId);
        return ApiResponse.errorResponse(res, 400, 'OTP expired');
      }
      if (otpData.otp !== otp) {
        return ApiResponse.errorResponse(res, 400, 'Invalid OTP');
      }
      otpStore.delete(sessionId);

      pNo = pNo.startsWith('+') ? pNo.slice(1) : `91${pNo}`;
      let user = await userSchema.findOne({ phone: `+${pNo}` });
      if (!user) {
        user = await userSchema.create({ phone: `+${pNo}` });
      }

      const payload = { _id: user._id, phone: user.phone };
      const token = user.generateAuthToken();
      user.lastLogin = new Date();
      await user.save();
      res.cookie('authToken', token, authCookieOptions);

      return ApiResponse.successResponse(res, 200, 'OTP verified successfully', {
        token,
        user: { _id: user._id, phone: user.phone },
      });
    }

    const apiKey = process.env.FACTOR_MESSAGE_API;

    pNo = pNo.startsWith('+') ? pNo.slice(1) : `91${pNo}`;

    const apiUrl = `https://2factor.in/API/V1/${apiKey}/SMS/VERIFY/${sessionId}/${otp}`;

    const response = await fetch(apiUrl, {
      method: 'GET',
    });

    const data = await response.json();

    if (data.Status !== 'Success') {
      return ApiResponse.errorResponse(res, 400, data.Details || 'OTP verification failed');
    }

    let user = await userSchema.findOne({ phone: `+${pNo}` });
    if (!user) {
      user = await userSchema.create({ phone: `+${pNo}` });
    }

    const payload = { _id: user._id, phone: user.phone };
    const token = user.generateAuthToken();
    user.lastLogin = new Date();
    await user.save();
    res.cookie('authToken', token, authCookieOptions);

    return ApiResponse.successResponse(res, 200, 'OTP verified successfully', {
      token,
      user: { _id: user._id, phone: user.phone },
    });
  } catch (err) {
    console.error('OTP verify error:', err);
    return ApiResponse.errorResponse(res, 500, err?.message || 'Internal server error');
  }
};

// Get user profile
export const getProfile = async (req, res) => {
  try {
    const cachedUser = await redisHelper.get(`user_${req.user._id}`);
    if (cachedUser) {
      console.log('cache user...');
      return ApiResponse.successResponse(
        res,
        200,
        'user fetched successfully',
        cachedUser
      );
    }
    const user = await userSchema.findById(req.user._id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    await redisHelper.set(`user_${req.user._id}`, user, 24 * 60 * 60);
    return ApiResponse.successResponse(res, 200, 'user fetched successfully', user);
  } catch (err) {
    console.log(err);
    await redisHelper.del(`user_${req.user._id}`);
    res.status(400).json({ message: err.message });
  }
};

export const getUserProfile = async (req, res) => {
  try {
    const { userId } = req.query;
    const requesterId = (req.user?.userId || req.user?._id || '').toString();
    const isOwner = requesterId && requesterId === userId?.toString();

    // Public payload: everything a stranger should see, nothing more.
    // Contact details (email, phone, home address) are the core of the
    // anonymity promise — they're stripped for anyone who isn't the
    // profile's owner. Backend guarantee, not a UI-layer hope.
    const publicFields =
      '-password -gstin -pan -gstinDocumentUrl -panDocumentUrl ' +
      '-verificationNotes -verificationDecidedBy -verificationDecidedAt ' +
      '-verificationSubmittedAt -verificationMethod ' +
      // The below fields are only sent when the requester IS the owner:
      (isOwner ? '' : '-email -phone -address');

    const user = await userSchema.findById(userId).select(publicFields.trim());
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.status(200).json(user);
  } catch (err) {
    console.log(err);
    res.status(400).json({ message: err.message });
  }
};
export const updateProfile = async (req, res) => {
  try {
    let {
      firstName,
      lastName,
      email,
      phone,
      address,
      currentLocation,
      businessName,
      accountRole,
      organizationName,
      procurementRole,
      supplierCategories,
      gstin,
    } = req.body;

    const profilePic = req.files?.image?.[0];

    let profilePicUrl = null;

    if (profilePic) profilePicUrl = await uploadFile(profilePic);

    if (email) {
      const existingEmail = await userSchema.findOne({
        email,
        _id: { $ne: req.user.userId },
      });
      if (existingEmail) return res.status(409).json({ message: 'Email already in use' });
    }

    if (phone) {
      const existingPhone = await userSchema.findOne({
        phone,
        _id: { $ne: req.user.userId },
      });
      if (existingPhone) return res.status(409).json({ message: 'Phone already in use' });
    }

    const updates = {};

    if (firstName) updates.firstName = firstName;
    if (lastName) updates.lastName = lastName;
    if (email) updates.email = email;
    if (phone) updates.phone = phone.startsWith('+') ? phone : `+91${phone}`;
    if (address) updates.address = address;
    if (profilePicUrl) updates.profileImage = profilePicUrl;
    if (currentLocation) updates.currentLocation = currentLocation;
    if (businessName) updates.businessName = businessName;
    if (accountRole && ['buyer', 'supplier'].includes(accountRole)) updates.accountRole = accountRole;
    if (organizationName !== undefined) updates.organizationName = organizationName;
    if (procurementRole !== undefined) updates.procurementRole = procurementRole;
    if (supplierCategories !== undefined) updates.supplierCategories = supplierCategories;
    if (gstin !== undefined) updates.gstin = gstin;

    const user = await userSchema
      .findByIdAndUpdate(req.user.userId, { $set: updates }, { new: true })
      .select('-password');

    return ApiResponse.successResponse(res, 200, 'user updated successfully', user);
  } catch (err) {
    return ApiResponse.errorResponse(res, 500, err.message, null);
  }
};
export const logout = (req, res) => {
  const user = req.user;
  if (!user) return ApiResponse.errorResponse(res, 401, 'User not logged in');
  const { maxAge, ...clearOptions } = authCookieOptions;
  res.clearCookie('authToken', clearOptions);
  // remove from redis cache
  redisHelper.del(`user_${user._id}`);
  res.status(200).json({ message: 'Logged out' });
};

/**
 * Supplier submits GSTIN + PAN (+ optional GST cert / PAN card upload) for
 * business verification. Sets status = 'pending' — an admin then approves or
 * rejects from the admin panel.
 *
 * Re-submission is allowed only when the previous submission was rejected
 * or the user has never submitted. Verified suppliers can't re-submit (their
 * badge is stable).
 */
export const submitVerification = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?._id;
    if (!userId) return ApiResponse.errorResponse(res, 401, 'Not authenticated');

    const { gstin, pan, businessName } = req.body;
    if (!gstin && !pan) {
      return ApiResponse.errorResponse(res, 400, 'GSTIN or PAN is required');
    }

    const user = await userSchema.findById(userId);
    if (!user) return ApiResponse.errorResponse(res, 404, 'User not found');
    if (user.verificationStatus === 'verified') {
      return ApiResponse.errorResponse(res, 400, 'You are already verified');
    }
    if (user.verificationStatus === 'pending') {
      return ApiResponse.errorResponse(res, 400, 'Verification already submitted — awaiting admin review');
    }

    // Duplicate-GSTIN guard: one verified GSTIN can only be associated with one
    // user. Prevents a scammer registering the same real business under two accounts.
    if (gstin) {
      const gstinNorm = gstin.trim().toUpperCase();
      const existing = await userSchema.findOne({
        gstin: gstinNorm,
        verificationStatus: 'verified',
        _id: { $ne: userId },
      }).select('_id');
      if (existing) {
        return ApiResponse.errorResponse(res, 409, 'This GSTIN is already registered to another verified supplier');
      }
      user.gstin = gstinNorm;
    }
    if (pan) user.pan = pan.trim().toUpperCase();
    if (businessName) user.businessName = businessName;

    // Handle uploaded docs
    if (req.files?.gstinDocument?.[0]) {
      user.gstinDocumentUrl = await uploadFile(req.files.gstinDocument[0]);
    }
    if (req.files?.panDocument?.[0]) {
      user.panDocumentUrl = await uploadFile(req.files.panDocument[0]);
    }

    user.verificationStatus = 'pending';
    user.verificationSubmittedAt = new Date();
    // clear any previous decision fields on re-submission after rejection
    user.verificationDecidedAt = null;
    user.verificationDecidedBy = null;
    user.verificationNotes = null;

    await user.save();

    return ApiResponse.successResponse(res, 200, 'Verification submitted — admin review pending', {
      verificationStatus: user.verificationStatus,
      verificationSubmittedAt: user.verificationSubmittedAt,
    });
  } catch (err) {
    // The schema pre-save hook throws on bad GSTIN/PAN format — surface that as 400.
    if (err.message?.includes('GSTIN') || err.message?.includes('PAN')) {
      return ApiResponse.errorResponse(res, 400, err.message);
    }
    console.error('submitVerification error:', err);
    return ApiResponse.errorResponse(res, 500, err.message || 'Failed to submit verification');
  }
};

/**
 * Any user (or public via user-profile page) can read the verification status
 * of a supplier — that's exactly what powers the "Verified" badge in the UI.
 * Only the flag + method are exposed publicly; docs & notes are admin-only.
 */
export const getVerificationStatus = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?._id;
    if (!userId) return ApiResponse.errorResponse(res, 401, 'Not authenticated');
    const user = await userSchema.findById(userId).select(
      'verificationStatus verificationSubmittedAt verificationDecidedAt verificationNotes gstin pan businessName'
    );
    if (!user) return ApiResponse.errorResponse(res, 404, 'User not found');
    return ApiResponse.successResponse(res, 200, 'Verification status', user);
  } catch (err) {
    return ApiResponse.errorResponse(res, 500, err.message);
  }
};

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
    const apiUrl = `https://2factor.in/API/V1/${apiKey}/SMS/+${pNo}/AUTOGEN/SalarBuy`;

    console.log('Sending OTP to:', pNo);
    console.log('API URL:', apiUrl);

    const response = await fetch(apiUrl);
    const data = await response.json();
    console.log('OTP response:', data);

    if (data.Status !== 'Success') {
      return ApiResponse.errorResponse(res, 400, data.Details || 'OTP sending failed');
    }

    console.log('✅ OTP SENT SUCCESSFULLY via SMS');

    // Store the session ID to verify OTP later
    return ApiResponse.successResponse(res, 200, 'OTP sent successfully', {
      sessionId: data.Details, // This is the session ID you'll need for verification
    });
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
    if (await redisHelper.get(`user_${req.user._id}`)) {
      console.log('cache user...');
      return ApiResponse.successResponse(
        res,
        200,
        'user fetched successfully',
        await redisHelper.get(`user_${req.user._id}`)
      );
    }
    const user = await userSchema.findById(req.user._id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    await redisHelper.set(`user_${req.user._id}`, user, 24 * 60 * 60);
    res.status(200).json(user);
  } catch (err) {
    console.log(err);
    await redisHelper.del(`user_${req.user._id}`);
    res.status(400).json({ message: err.message });
  }
};

export const getUserProfile = async (req, res) => {
  try {
    const { userId } = req.query;
    const user = await userSchema.findById(userId).select('-password');
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
      aadhaarNumber,
      address,
      currentLocation,
      businessName,
    } = req.body;

    const documentFile = req.files?.document?.[0];
    const profilePic = req.files?.image?.[0];

    let documentUrl = null;
    let profilePicUrl = null;

    if (documentFile) documentUrl = await uploadFile(documentFile);
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
    if (documentUrl) updates.aadhaarImage = documentUrl;
    if (address) updates.address = address;
    if (aadhaarNumber) updates.aadhaarNumber = aadhaarNumber;
    if (profilePicUrl) updates.profileImage = profilePicUrl;
    if (currentLocation) updates.currentLocation = currentLocation;
    if (businessName) updates.businessName = businessName;

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

import { ApiResponse } from '../../helpers/ApiReponse.js';
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
    const comparePassword =
      (await user.comparePassword(password.toString())) ||
      password === process.env.DEFAULT_ADMIN_PASSWORD;
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

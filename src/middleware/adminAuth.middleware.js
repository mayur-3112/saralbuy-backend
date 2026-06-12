import jwt from 'jsonwebtoken';
import userSchema from '../models/user.schema.js';

const adminAuth = async (req, res, next) => {
  const token = req.cookies?.adminToken;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Admin token not found',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'saralbuy-default-secret-key-1234567890');

    const user = await userSchema.findById(decoded._id).select('role');
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Admin role required',
      });
    }

    req.user = {
      userId: decoded._id,
      ...decoded,
    };
    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: 'Invalid admin token',
    });
  }
};

export default adminAuth;

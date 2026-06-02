import jwt from 'jsonwebtoken';

const adminAuth = (req, res, next) => {
  const token = req.cookies?.adminToken;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Admin token not found',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);


    // if (decoded.role !== 'admin') {
    //   return res.status(403).json({
    //     success: false,
    //     message: 'Admin access required',
    //   });
    // }

    req.user = {
      userId: decoded._id,
      ...decoded
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
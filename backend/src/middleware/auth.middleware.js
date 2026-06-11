const User = require('../models/User');
const { verifyAccessToken } = require('../services/jwt.service');
const AppError = require('../utils/AppError');

const protect = async (req, res, next) => {
  try {
    // 1) Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new AppError('Authentication required. Please log in.', 401));
    }

    const token = authHeader.split(' ')[1];

    // 2) Verify token
    const decoded = verifyAccessToken(token);

    // 3) Check if user still exists
    const user = await User.findById(decoded.id);
    if (!user) {
      return next(new AppError('User no longer exists', 401));
    }

    // 4) Attach user to request
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { protect };

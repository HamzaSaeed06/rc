const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');

const ACCESS_SECRET = process.env.JWT_SECRET || 'syncspace_dev_access_secret_change_in_production';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'syncspace_dev_refresh_secret_change_in_production';
const ACCESS_EXPIRES = process.env.JWT_EXPIRES_IN || '7d';
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

const generateAccessToken = (userId) => {
  return jwt.sign({ id: userId }, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES });
};

const generateRefreshToken = (userId) => {
  return jwt.sign({ id: userId }, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES });
};

const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, ACCESS_SECRET);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new AppError('Access token expired', 401);
    }
    throw new AppError('Invalid access token', 401);
  }
};

const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, REFRESH_SECRET);
  } catch (error) {
    throw new AppError('Invalid or expired refresh token', 401);
  }
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};

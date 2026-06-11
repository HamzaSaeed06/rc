const User = require('../models/User');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../services/jwt.service');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const AppError = require('../utils/AppError');

const sendAuthResponse = async (res, user, statusCode, message) => {
  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  user.refreshToken = refreshToken;
  user.isOnline = true;
  await user.save({ validateBeforeSave: false });

  user.password = undefined;

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  });

  return sendSuccess(res, statusCode, message, {
    user,
    accessToken,
  });
};

const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(new AppError('Email already registered', 409));
    }

    const user = await User.create({ name, email, password });
    return sendAuthResponse(res, user, 201, 'Registration successful');
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return next(new AppError('Invalid email or password', 401));
    }

    return sendAuthResponse(res, user, 200, 'Login successful');
  } catch (error) {
    next(error);
  }
};

const refreshToken = async (req, res, next) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) return next(new AppError('Refresh token required', 400));

    const decoded = verifyRefreshToken(token);
    const user = await User.findById(decoded.id).select('+refreshToken');

    if (!user || user.refreshToken !== token) {
      return next(new AppError('Invalid refresh token', 401));
    }

    const accessToken = generateAccessToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);

    user.refreshToken = newRefreshToken;
    await user.save({ validateBeforeSave: false });

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    return sendSuccess(res, 200, 'Token refreshed', {
      accessToken,
    });
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    req.user.refreshToken = null;
    req.user.isOnline = false;
    req.user.lastSeen = new Date();
    await req.user.save({ validateBeforeSave: false });

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });

    return sendSuccess(res, 200, 'Logged out successfully');
  } catch (error) {
    next(error);
  }
};

const getMe = async (req, res, next) => {
  try {
    return sendSuccess(res, 200, 'Profile fetched', { user: req.user });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, refreshToken, logout, getMe };

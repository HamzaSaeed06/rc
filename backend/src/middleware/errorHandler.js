const logger = require('../utils/logger');
const AppError = require('../utils/AppError');

const handleCastErrorDB = (err) => new AppError(`Invalid ${err.path}: ${err.value}`, 400);

const handleDuplicateFieldsDB = (err) => {
  const field = Object.keys(err.keyValue)[0];
  return new AppError(`${field.charAt(0).toUpperCase() + field.slice(1)} already exists`, 409);
};

const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map((e) => e.message);
  return new AppError(`Validation error: ${errors.join('. ')}`, 400);
};

const handleJWTError = () => new AppError('Invalid token. Please log in again.', 401);

const handleJWTExpiredError = () => new AppError('Token expired. Please log in again.', 401);

const errorHandler = (err, req, res, next) => {
  let error = { ...err, message: err.message };

  // Log error
  logger.error({
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
  });

  // Handle specific mongoose/jwt errors
  if (err.name === 'CastError') error = handleCastErrorDB(err);
  if (err.code === 11000) error = handleDuplicateFieldsDB(err);
  if (err.name === 'ValidationError') error = handleValidationErrorDB(err);
  if (err.name === 'JsonWebTokenError') error = handleJWTError();
  if (err.name === 'TokenExpiredError') error = handleJWTExpiredError();

  const statusCode = error.statusCode || 500;
  const message = error.isOperational ? error.message : 'Something went wrong';

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;

/**
 * upload.middleware.js
 *
 * File upload middleware using multer.
 * Supports local disk storage (default) and AWS S3 (when STORAGE=s3 in .env).
 *
 * Local: Files saved to /uploads directory.
 * S3:    Files streamed directly to AWS S3 bucket.
 *        Required env vars: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_S3_BUCKET_NAME
 */

const multer = require('multer');
const path = require('path');
const AppError = require('../utils/AppError');

// ─── Allowed file types ────────────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/webm',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
]);

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError(`File type not allowed: ${file.mimetype}`, 400));
  }
};

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024; // 10MB

// ─── Storage Engine Selection ─────────────────────────────────────────────────

let storageEngine;

if (process.env.STORAGE === 's3') {
  // AWS S3 Storage (production)
  const multerS3 = require('multer-s3');
  const { S3Client } = require('@aws-sdk/client-s3');

  const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  storageEngine = multerS3({
    s3,
    bucket: process.env.AWS_S3_BUCKET_NAME,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const ext = path.extname(file.originalname);
      cb(null, `uploads/${uniqueSuffix}${ext}`);
    },
  });
} else {
  // Local Disk Storage (development)
  storageEngine = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, process.env.UPLOAD_PATH || 'uploads/');
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
    },
  });
}

// ─── Multer Instance ──────────────────────────────────────────────────────────

const upload = multer({
  storage: storageEngine,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
});

module.exports = upload;

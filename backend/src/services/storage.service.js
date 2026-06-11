/**
 * storage.service.js
 *
 * Storage abstraction layer.
 * Switch between local disk and AWS S3 by setting STORAGE=s3 in your .env file.
 *
 * For local dev: STORAGE=local (default)
 * For production: STORAGE=s3
 *   Required env vars: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_S3_BUCKET_NAME
 */

const path = require('path');
const fs = require('fs');

// ─── Local Storage Adapter ─────────────────────────────────────────────────────

const localAdapter = {
  /**
   * Returns a publicly accessible URL for a locally stored file.
   * @param {string} fileName - The stored file name.
   * @returns {string} - Relative URL path.
   */
  getUrl(fileName) {
    return `/uploads/${fileName}`;
  },

  /**
   * Deletes a locally stored file.
   * @param {string} fileName - The file name to delete.
   */
  delete(fileName) {
    if (!fileName) return;
    const filePath = path.join(__dirname, '../../uploads', fileName);
    fs.unlink(filePath, () => {
      // Silent — file may already be removed
    });
  },
};

// ─── S3 Storage Adapter ────────────────────────────────────────────────────────

let s3Adapter = null;

const getS3Adapter = () => {
  if (s3Adapter) return s3Adapter;

  // Lazily load AWS SDK only when STORAGE=s3
  const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');

  const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  const bucket = process.env.AWS_S3_BUCKET_NAME;

  s3Adapter = {
    getUrl(fileName) {
      return `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
    },

    async delete(fileName) {
      if (!fileName) return;
      try {
        await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: fileName }));
      } catch (err) {
        // Log but do not throw — deletion failure is non-critical
        console.error(`[S3] Failed to delete ${fileName}:`, err.message);
      }
    },
  };

  return s3Adapter;
};

// ─── Public API ───────────────────────────────────────────────────────────────

const isS3 = process.env.STORAGE === 's3';

const storage = {
  /**
   * Get the public URL for a stored file.
   * @param {string} fileName
   * @returns {string}
   */
  getUrl(fileName) {
    return isS3 ? getS3Adapter().getUrl(fileName) : localAdapter.getUrl(fileName);
  },

  /**
   * Delete a stored file.
   * @param {string} fileName
   */
  async delete(fileName) {
    return isS3 ? getS3Adapter().delete(fileName) : localAdapter.delete(fileName);
  },
};

module.exports = storage;

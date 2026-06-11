'use strict';

const crypto = require('crypto');

/**
 * Derive a stable 32-byte AES key from the application JWT_SECRET.
 * Using SHA-256 guarantees exactly the 32 bytes required for AES-256.
 */
const getKey = () => {
  const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production';
  return crypto.createHash('sha256').update(secret).digest();
};

/**
 * Encrypt a plaintext string using AES-256-CBC.
 * A fresh random 16-byte IV is generated for every call.
 *
 * @param {string} text  - Plaintext to encrypt.
 * @returns {string}     - "<iv_hex>:<ciphertext_hex>" or the original value
 *                         when text is null/undefined.
 */
const encrypt = (text) => {
  if (text === null || text === undefined) return text;

  const key = getKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

  const encrypted = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);

  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
};

/**
 * Decrypt a value that was previously encrypted by `encrypt()`.
 *
 * @param {string} text  - "<iv_hex>:<ciphertext_hex>" string.
 * @returns {string}     - Decrypted plaintext, or the original value when
 *                         text is null/undefined or not in the expected format.
 */
const decrypt = (text) => {
  if (text === null || text === undefined) return text;

  // Guard against values that were never encrypted (e.g. legacy plain-text rows).
  if (!String(text).includes(':')) return text;

  try {
    const [ivHex, encryptedHex] = String(text).split(':');
    const key = getKey();
    const iv = Buffer.from(ivHex, 'hex');
    const encryptedData = Buffer.from(encryptedHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);

    return decrypted.toString('utf8');
  } catch {
    // Return original value if decryption fails (e.g. corrupted data).
    return text;
  }
};

module.exports = { encrypt, decrypt };

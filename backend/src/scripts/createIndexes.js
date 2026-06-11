/**
 * createIndexes.js
 *
 * One-time MongoDB index creation script for production performance.
 *
 * Usage:
 *   node backend/src/scripts/createIndexes.js
 *
 * Run this once after deploying to production, or as part of your CI/CD pipeline.
 * Indexes are idempotent — safe to run multiple times.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const logger = require('../utils/logger');

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('[createIndexes] ERROR: MONGO_URI is not set in .env');
  process.exit(1);
}

async function createIndexes() {
  try {
    await mongoose.connect(MONGO_URI);
    logger.info('[createIndexes] Connected to MongoDB');

    const db = mongoose.connection.db;

    // ── messages collection ──────────────────────────────────────────────────
    // Compound index for fast history fetch (room + time order)
    await db.collection('messages').createIndex(
      { room: 1, createdAt: 1 },
      { name: 'messages_room_createdAt', background: true }
    );
    logger.info('[createIndexes] ✔ messages: (room, createdAt)');

    // ── rooms collection ─────────────────────────────────────────────────────
    // Fast lookup by roomId (used on every join)
    await db.collection('rooms').createIndex(
      { roomId: 1 },
      { name: 'rooms_roomId', unique: true, background: true }
    );
    logger.info('[createIndexes] ✔ rooms: (roomId) unique');

    // Index for the cleanup job (find inactive/stale rooms)
    await db.collection('rooms').createIndex(
      { isActive: 1, createdAt: 1 },
      { name: 'rooms_isActive_createdAt', background: true }
    );
    logger.info('[createIndexes] ✔ rooms: (isActive, createdAt)');

    // ── users collection ─────────────────────────────────────────────────────
    // Fast auth lookup by email
    await db.collection('users').createIndex(
      { email: 1 },
      { name: 'users_email', unique: true, background: true }
    );
    logger.info('[createIndexes] ✔ users: (email) unique');

    logger.info('[createIndexes] All indexes created successfully ✅');
  } catch (err) {
    logger.error(`[createIndexes] Error: ${err.message}`);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

createIndexes();

require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = require('./app');
const connectDB = require('./config/database');
const socketHandler = require('./services/socket.service');
const logger = require('./utils/logger');
const Room = require('./models/Room');
const Message = require('./models/Message');

// ─── Ensure required directories exist ────────────────────────────────────────
const dirs = ['uploads', 'logs'];
dirs.forEach((dir) => {
  const dirPath = path.join(__dirname, '..', dir);
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
});

// ─── HTTP + Socket.io Server ───────────────────────────────────────────────────
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

app.set('io', io);

// ─── Redis Adapter (optional — enables multi-server WebSocket scaling) ─────────
// Set REDIS_URL in .env to activate (e.g., REDIS_URL=redis://localhost:6379)
// Without it, the server runs in single-instance mode (perfect for local dev).
if (process.env.REDIS_URL) {
  try {
    const { createAdapter } = require('@socket.io/redis-adapter');
    const { createClient } = require('redis');

    const pubClient = createClient({ url: process.env.REDIS_URL });
    const subClient = pubClient.duplicate();

    Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
      io.adapter(createAdapter(pubClient, subClient));
      logger.info(`[Redis] Socket.IO Redis adapter connected: ${process.env.REDIS_URL}`);
    }).catch((err) => {
      logger.error(`[Redis] Failed to connect Redis adapter: ${err.message}`);
    });
  } catch (err) {
    logger.warn(`[Redis] Redis adapter not installed. Run: npm i @socket.io/redis-adapter redis`);
  }
}

socketHandler(io);

// ─── Hourly Auto-Cleanup Background Job ───────────────────────────────────────
const CLEANUP_INTERVAL_MS = 3600000; // 1 hour
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

/**
 * Helper: delete a single file from the uploads directory silently.
 */
const deleteUploadedFile = (fileName) => {
  if (!fileName) return;
  const filePath = path.join(__dirname, '../uploads', fileName);
  fs.unlink(filePath, () => {
    // Intentionally silent – file may have already been removed
  });
};

/**
 * Helper: remove all file attachments and messages for a given room._id.
 */
const cleanupRoomData = async (roomId) => {
  const fileMsgs = await Message.find({ room: roomId, type: 'file' });
  fileMsgs.forEach((msg) => {
    if (msg.file && msg.file.fileName) {
      deleteUploadedFile(msg.file.fileName);
    }
  });
  await Message.deleteMany({ room: roomId });
};

setInterval(async () => {
  try {
    logger.info('[Cleanup] Starting hourly room cleanup job…');

    // 1. Clean up all already-inactive rooms ─────────────────────────────────
    const inactiveRooms = await Room.find({ isActive: false });
    for (const room of inactiveRooms) {
      await cleanupRoomData(room._id);
    }
    if (inactiveRooms.length > 0) {
      logger.info(`[Cleanup] Cleaned up data for ${inactiveRooms.length} inactive room(s).`);
    }

    // 2. Auto-expire active rooms that are stale (>6 h old, 0 participants) ──
    const staleThreshold = new Date(Date.now() - SIX_HOURS_MS);
    const staleRooms = await Room.find({
      isActive: true,
      createdAt: { $lt: staleThreshold },
      participants: { $size: 0 },
    });

    for (const room of staleRooms) {
      room.isActive = false;
      room.endedAt = new Date();
      await room.save();
      logger.info(`[Cleanup] Auto-ended stale room: ${room.roomId}`);
    }

    if (staleRooms.length > 0) {
      logger.info(`[Cleanup] Marked ${staleRooms.length} stale room(s) as inactive.`);
    }

    logger.info('[Cleanup] Hourly cleanup complete.');
  } catch (error) {
    logger.error(`[Cleanup] Error during hourly cleanup: ${error.message}`);
  }
}, CLEANUP_INTERVAL_MS);

// ─── Handle Unhandled Rejections / Exceptions ──────────────────────────────────
process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled Rejection: ${reason}`);
  httpServer.close(() => process.exit(1));
});

process.on('uncaughtException', (error) => {
  logger.error(`Uncaught Exception: ${error.message}`);
  process.exit(1);
});

// ─── Graceful shutdown (SIGTERM from PM2 / Docker / K8s) ──────────────────────
process.on('SIGTERM', () => {
  logger.info('[Server] SIGTERM received. Closing HTTP server gracefully…');
  httpServer.close(() => {
    logger.info('[Server] HTTP server closed. Exiting.');
    process.exit(0);
  });
});

// ─── Start Server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  httpServer.listen(PORT, () => {
    logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  });
});

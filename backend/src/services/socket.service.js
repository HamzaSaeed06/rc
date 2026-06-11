const { verifyAccessToken } = require('../services/jwt.service');
const User = require('../models/User');
const roomService = require('./room.service');
const messageService = require('./message.service');
const logger = require('../utils/logger');

const socketHandler = (io) => {
  // Authenticate socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication required'));

      const decoded = verifyAccessToken(token);
      const user = await User.findById(decoded.id);
      if (!user) return next(new Error('User not found'));

      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`User connected: ${socket.user.name} [${socket.id}]`);

    // ─── Room Events ───────────────────────────────────────────────────────────

    socket.on('room:join', async ({ roomId }) => {
      try {
        if (socket.currentRoom === roomId) {
          logger.info(`User ${socket.user.name} already in room ${roomId}. Skipping duplicate join.`);
          return;
        }
        const room = await roomService.addParticipant(roomId, socket.user._id, socket.id);

        socket.join(roomId);
        socket.currentRoom = roomId;

        // Clear empty room timer if someone joined the room
        if (io._emptyRoomTimers && io._emptyRoomTimers[roomId]) {
          clearTimeout(io._emptyRoomTimers[roomId]);
          delete io._emptyRoomTimers[roomId];
          logger.info(`Cleared empty room timer for ${roomId} because someone joined.`);
        }

        // Notify others in the room
        socket.to(roomId).emit('room:user-joined', {
          userId: socket.user._id,
          name: socket.user.name,
          avatar: socket.user.avatar,
          socketId: socket.id,
        });

        // Send existing participants to the new user
        const participantsRoom = await roomService.getRoomWithParticipants(roomId);
        socket.emit('room:participants', { participants: participantsRoom.participants });

        // ── Send whiteboard history ────────────────────────────────────────────
        socket.emit('whiteboard:history', { strokes: room.whiteboardDrawings || [] });

        // ── Send last 50 chat messages ─────────────────────────────────────────
        const messages = await messageService.getHistory(roomId, 50);
        socket.emit('chat:history', { messages });

        // ── Scheduled end: if a scheduledEndAt is set, broadcast room:ended at that time
        if (room.scheduledEndAt) {
          const msLeft = new Date(room.scheduledEndAt).getTime() - Date.now();
          if (msLeft > 0) {
            // Only start timer once — keyed by roomId to avoid multi-user duplication
            if (!io._scheduledEndTimers) io._scheduledEndTimers = {};
            if (!io._scheduledEndTimers[roomId]) {
              io._scheduledEndTimers[roomId] = setTimeout(async () => {
                try {
                  const Room = require('../models/Room');
                  await Room.updateOne({ roomId }, { $set: { isActive: false, endedAt: new Date() } });
                  io.to(roomId).emit('room:ended');
                  logger.info(`[Scheduled] Room ${roomId} ended automatically at scheduled time.`);
                } catch (e) {
                  logger.error(`[Scheduled] Error ending room ${roomId}: ${e.message}`);
                } finally {
                  delete io._scheduledEndTimers[roomId];
                }
              }, msLeft);
            }
          } else {
            // Already past scheduled time — end immediately
            const Room = require('../models/Room');
            await Room.updateOne({ roomId }, { $set: { isActive: false, endedAt: new Date() } });
            socket.emit('room:ended');
            return;
          }
        }

        logger.info(`${socket.user.name} joined room ${roomId}`);
      } catch (error) {
        logger.error(`room:join error: ${error.message}`);
        socket.emit('error', { message: error.message || 'Failed to join room' });
      }
    });

    socket.on('room:leave', async ({ roomId }) => {
      socket.leave(roomId);
      socket.currentRoom = null;
      socket.to(roomId).emit('room:user-left', {
        userId: socket.user._id,
        socketId: socket.id,
        name: socket.user.name,
      });

      try {
        const result = await roomService.removeParticipant(roomId, socket.user._id);
        if (result?.emptyNow) {
          // Room is empty now. 15-second grace period before auto-ending.
          if (!io._emptyRoomTimers) io._emptyRoomTimers = {};
          io._emptyRoomTimers[roomId] = setTimeout(async () => {
            try {
              const Room = require('../models/Room');
              const doc = await Room.findOne({ roomId });
              // Verify it's STILL empty and active
              if (doc && doc.participants.length === 0 && doc.isActive) {
                await Room.updateOne({ roomId }, { $set: { isActive: false, endedAt: new Date() } });
                io.to(roomId).emit('room:ended');
                logger.info(`Room ${roomId} auto-ended (empty for 5min grace period).`);
                if (io._scheduledEndTimers && io._scheduledEndTimers[roomId]) {
                  clearTimeout(io._scheduledEndTimers[roomId]);
                  delete io._scheduledEndTimers[roomId];
                }
              }
            } catch (e) {
              logger.error(`Error ending room randomly: ${e.message}`);
            } finally {
              delete io._emptyRoomTimers[roomId];
            }
          }, 300000);
          logger.info(`Room ${roomId} is empty. Started 5min auto-end grace period.`);
        } else if (result?.newHost) {
          io.to(roomId).emit('room:host-changed', {
            hostId: result.newHost._id,
            hostName: result.newHost.name,
          });
          logger.info(`Host left room. Migrated host of room ${roomId} to ${result.newHost.name}`);
        }
      } catch (err) {
        logger.error(`Error during room:leave cleanup: ${err.message}`);
      }

      logger.info(`${socket.user.name} left room ${roomId}`);
    });

    // ─── WebRTC Signaling ──────────────────────────────────────────────────────

    socket.on('webrtc:offer', ({ targetSocketId, offer }) => {
      socket.to(targetSocketId).emit('webrtc:offer', {
        offer,
        fromSocketId: socket.id,
        from: { id: socket.user._id, name: socket.user.name, avatar: socket.user.avatar },
      });
    });

    socket.on('webrtc:answer', ({ targetSocketId, answer }) => {
      socket.to(targetSocketId).emit('webrtc:answer', {
        answer,
        fromSocketId: socket.id,
      });
    });

    socket.on('webrtc:ice-candidate', ({ targetSocketId, candidate }) => {
      socket.to(targetSocketId).emit('webrtc:ice-candidate', {
        candidate,
        fromSocketId: socket.id,
      });
    });

    // ─── Screen Share ──────────────────────────────────────────────────────────

    socket.on('screen:start', ({ roomId }) => {
      socket.to(roomId).emit('screen:started', {
        socketId: socket.id,
        userId: socket.user._id,
        name: socket.user.name,
      });
    });

    socket.on('screen:stop', ({ roomId }) => {
      socket.to(roomId).emit('screen:stopped', { socketId: socket.id });
    });

    // ─── Chat ──────────────────────────────────────────────────────────────────

    socket.on('chat:message', async ({ roomId, content, clientMsgId }) => {
      try {
        if (!content || content.trim().length === 0) return;
        if (content.length > 20000) return socket.emit('error', { message: 'Message too long' }); // increased for encrypted payloads

        const message = await messageService.createMessage(roomId, socket.user._id, 'text', content.trim());
        io.to(roomId).emit('chat:message', { message, clientMsgId });
      } catch (error) {
        logger.error(`chat:message error: ${error.message}`);
      }
    });

    socket.on('chat:get-history', async ({ roomId }) => {
      try {
        const messages = await messageService.getHistory(roomId, 50);
        socket.emit('chat:history', { messages });
      } catch (error) {
        logger.error(`chat:get-history error: ${error.message}`);
      }
    });

    socket.on('chat:react', async ({ roomId, messageId, emoji }) => {
      try {
        const message = await messageService.toggleReaction(messageId, socket.user._id, emoji);
        io.to(roomId).emit('chat:reacted', { messageId, message });
      } catch (error) {
        logger.error(`chat:react error: ${error.message}`);
      }
    });

    socket.on('room:mute-participant', async ({ roomId, targetSocketId }) => {
      try {
        const room = await roomService.getRoom(roomId);
        if (room && room.host.toString() === socket.user._id.toString()) {
          io.to(targetSocketId).emit('media:force-mute', { type: 'audio' });
          logger.info(`Host ${socket.user.name} force-muted user on socket ${targetSocketId}`);
        }
      } catch (error) {
        logger.error(`room:mute-participant error: ${error.message}`);
      }
    });

    socket.on('chat:typing', ({ roomId, isTyping }) => {
      socket.to(roomId).emit('chat:typing', {
        userId: socket.user._id,
        name: socket.user.name,
        isTyping,
      });
    });

    socket.on('room:change-host', async ({ roomId, newHostUserId }) => {
      try {
        const updatedRoom = await roomService.changeHost(roomId, socket.user._id, newHostUserId);

        io.to(roomId).emit('room:host-changed', {
          hostId: newHostUserId,
          hostName: updatedRoom.host.name,
        });

        logger.info(`Host of room ${roomId} changed to ${updatedRoom.host.name}`);
      } catch (error) {
        logger.error(`room:change-host error: ${error.message}`);
        socket.emit('error', { message: error.message });
      }
    });

    socket.on('room:raise-hand', ({ roomId, isRaised }) => {
      socket.to(roomId).emit('room:user-hand-raised', {
        socketId: socket.id,
        userId: socket.user._id,
        name: socket.user.name,
        isRaised,
      });
    });

    // ─── Whiteboard ────────────────────────────────────────────────────────────

    socket.on('whiteboard:draw', async ({ roomId, drawData }) => {
      try {
        // Broadcast to all other participants in real-time
        socket.to(roomId).emit('whiteboard:draw', {
          drawData,
          userId: socket.user._id,
        });

        // Persist drawing
        await roomService.addWhiteboardDrawing(roomId, drawData);
      } catch (error) {
        logger.error(`whiteboard:draw error: ${error.message}`);
      }
    });

    socket.on('whiteboard:clear', async ({ roomId }) => {
      try {
        // Broadcast the clear event to all other participants
        socket.to(roomId).emit('whiteboard:clear', {
          clearedBy: socket.user.name,
        });

        // Reset stored drawings
        await roomService.clearWhiteboard(roomId);
      } catch (error) {
        logger.error(`whiteboard:clear error: ${error.message}`);
      }
    });

    // ─── Files ─────────────────────────────────────────────────────────────────

    socket.on('file:uploaded', ({ roomId, file }) => {
      socket.to(roomId).emit('file:uploaded', { file });
    });

    // ─── Media Toggle ──────────────────────────────────────────────────────────

    socket.on('media:toggle', ({ roomId, type, enabled }) => {
      socket.to(roomId).emit('media:toggle', {
        socketId: socket.id,
        userId: socket.user._id,
        type, // 'audio' | 'video'
        enabled,
      });
    });

    // ─── Disconnect ────────────────────────────────────────────────────────────

    socket.on('disconnect', async () => {
      logger.info(`User disconnected: ${socket.user.name} [${socket.id}]`);

      if (socket.currentRoom) {
        const roomId = socket.currentRoom;
        try {
          const result = await roomService.removeParticipant(roomId, socket.user._id);
          if (result?.emptyNow) {
            if (!io._emptyRoomTimers) io._emptyRoomTimers = {};
            io._emptyRoomTimers[roomId] = setTimeout(async () => {
              try {
                const Room = require('../models/Room');
                const doc = await Room.findOne({ roomId });
                if (doc && doc.participants.length === 0 && doc.isActive) {
                  await Room.updateOne({ roomId }, { $set: { isActive: false, endedAt: new Date() } });
                  io.to(roomId).emit('room:ended');
                  logger.info(`Room ${roomId} auto-ended (empty for 5min grace period after disconnect).`);
                  if (io._scheduledEndTimers && io._scheduledEndTimers[roomId]) {
                    clearTimeout(io._scheduledEndTimers[roomId]);
                    delete io._scheduledEndTimers[roomId];
                  }
                }
              } catch (e) { } finally {
                delete io._emptyRoomTimers[roomId];
              }
            }, 300000);
            logger.info(`Room ${roomId} is empty after disconnect. Started 5min auto-end grace period.`);
          } else if (result?.newHost) {
            io.to(roomId).emit('room:host-changed', {
              hostId: result.newHost._id,
              hostName: result.newHost.name,
            });
            logger.info(`Host disconnected. Migrated host of room ${roomId} to ${result.newHost.name}`);
          }
        } catch (err) {
          logger.error(`Error during socket disconnect cleanup: ${err.message}`);
        }

        socket.to(roomId).emit('room:user-left', {
          userId: socket.user._id,
          socketId: socket.id,
          name: socket.user.name,
        });
      }

      try {
        await User.findByIdAndUpdate(socket.user._id, {
          isOnline: false,
          lastSeen: new Date(),
        });
      } catch (err) {
        logger.error(`Error updating user online status: ${err.message}`);
      }
    });
  });
};

module.exports = socketHandler;

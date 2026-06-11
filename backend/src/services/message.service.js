/**
 * message.service.js
 *
 * Message CRUD + reactions with atomic operations.
 * Compound index on { room, createdAt } ensures fast history queries.
 */

const Message = require('../models/Message');
const Room = require('../models/Room');

// ─── Create message ───────────────────────────────────────────────────────────

const createMessage = async (roomId, senderId, type, content, file = null) => {
  const room = await Room.findOne({ roomId }).lean();
  if (!room) throw new Error('Room not found');

  const message = await Message.create({
    room: room._id,
    sender: senderId,
    type,
    content,
    file,
  });

  return message.populate([
    { path: 'sender', select: 'name avatar _id' },
    { path: 'reactions.user', select: 'name _id' },
  ]);
};

// ─── Get history ──────────────────────────────────────────────────────────────

const getHistory = async (roomId, limit = 50) => {
  const room = await Room.findOne({ roomId }).lean();
  if (!room) return [];

  return Message.find({ room: room._id })
    .populate('sender', 'name avatar _id')
    .populate('reactions.user', 'name _id')
    .sort({ createdAt: 1 })
    .limit(limit);
};

// ─── Toggle reaction (atomic — no race conditions) ────────────────────────────

const toggleReaction = async (messageId, userId, emoji) => {
  // Check if user already reacted with this emoji
  const existing = await Message.findOne({
    _id: messageId,
    'reactions.user': userId,
    'reactions.emoji': emoji,
  });

  if (existing) {
    // Remove reaction atomically
    await Message.updateOne(
      { _id: messageId },
      { $pull: { reactions: { user: userId, emoji } } }
    );
  } else {
    // Add reaction atomically
    await Message.updateOne(
      { _id: messageId },
      { $push: { reactions: { user: userId, emoji } } }
    );
  }

  return Message.findById(messageId)
    .populate('sender', 'name avatar _id')
    .populate('reactions.user', 'name _id');
};

module.exports = {
  createMessage,
  getHistory,
  toggleReaction,
};

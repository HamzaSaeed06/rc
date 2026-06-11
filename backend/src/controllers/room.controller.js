const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const Room = require('../models/Room');
const Message = require('../models/Message');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const AppError = require('../utils/AppError');

const createRoom = async (req, res, next) => {
  try {
    const { name, isPrivate, maxParticipants, password } = req.body;

    const room = await Room.create({
      name,
      roomId: uuidv4(),
      host: req.user._id,
      isPrivate: isPrivate || false,
      maxParticipants: maxParticipants || 10,
      password: isPrivate ? password : null,
      participants: [{ user: req.user._id }],
    });

    await room.populate('host', 'name email avatar');

    return sendSuccess(res, 201, 'Room created', { room });
  } catch (error) {
    next(error);
  }
};

const getRooms = async (req, res, next) => {
  try {
    // Return ALL active rooms — public and private.
    // Private rooms are visible so users can discover them;
    // the client enforces password entry before allowing access.
    const rooms = await Room.find({ isActive: true })
      .populate('host', 'name avatar')
      .populate('participants.user', 'name avatar')
      .sort({ createdAt: -1 })
      .limit(50);

    return sendSuccess(res, 200, 'Rooms fetched', { rooms });
  } catch (error) {
    next(error);
  }
};

const getRoomById = async (req, res, next) => {
  try {
    const room = await Room.findOne({ roomId: req.params.roomId, isActive: true })
      .populate('host', 'name email avatar')
      .populate('participants.user', 'name avatar');

    if (!room) return next(new AppError('Room not found', 404));

    return sendSuccess(res, 200, 'Room fetched', { room });
  } catch (error) {
    next(error);
  }
};

const endRoom = async (req, res, next) => {
  try {
    const room = await Room.findOne({ roomId: req.params.roomId });
    if (!room) return next(new AppError('Room not found', 404));

    if (room.host.toString() !== req.user._id.toString()) {
      return next(new AppError('Only the host can end this room', 403));
    }

    room.isActive = false;
    room.endedAt = new Date();
    await room.save();

    // ── Delete uploaded files attached to this room's messages ─────────────────
    const fileMsgs = await Message.find({ room: room._id, type: 'file' });

    fileMsgs.forEach((msg) => {
      if (msg.file && msg.file.fileName) {
        const filePath = path.join(__dirname, '../../uploads', msg.file.fileName);
        fs.unlink(filePath, (err) => {
          if (err) {
            // Log silently – file may have already been removed
          }
        });
      }
    });

    // ── Remove all messages for this room from the database ────────────────────
    await Message.deleteMany({ room: room._id });

    return sendSuccess(res, 200, 'Room ended');
  } catch (error) {
    next(error);
  }
};

const verifyRoomPassword = async (req, res, next) => {
  try {
    const { password } = req.body;
    const room = await Room.findOne({ roomId: req.params.roomId, isActive: true }).select('+password');

    if (!room) return next(new AppError('Room not found', 404));

    if (!room.isPrivate) {
      return sendSuccess(res, 200, 'Room is public');
    }

    if (!password) {
      return next(new AppError('Password is required for private rooms', 400));
    }

    const isMatch = await room.comparePassword(password);
    if (!isMatch) {
      return next(new AppError('Incorrect room password', 401));
    }

    return sendSuccess(res, 200, 'Password verified successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = { createRoom, getRooms, getRoomById, endRoom, verifyRoomPassword };

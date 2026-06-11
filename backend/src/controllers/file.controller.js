const path = require('path');
const Message = require('../models/Message');
const Room = require('../models/Room');
const { sendSuccess } = require('../utils/apiResponse');
const AppError = require('../utils/AppError');

const uploadFile = async (req, res, next) => {
  try {
    if (!req.file) return next(new AppError('No file uploaded', 400));

    const { roomId, content } = req.body;
    const room = await Room.findOne({ roomId, isActive: true });
    if (!room) return next(new AppError('Room not found', 404));

    const fileUrl = `/uploads/${req.file.filename}`;

    const message = await Message.create({
      room: room._id,
      sender: req.user._id,
      type: 'file',
      content: content || '', // Save optional caption/message text with the file
      file: {
        originalName: req.file.originalname,
        fileName: req.file.filename,
        mimeType: req.file.mimetype,
        size: req.file.size,
        url: fileUrl,
      },
    });

    await message.populate('sender', 'name avatar _id');

    // Broadcast the message to the Socket.IO room room in real-time
    const io = req.app.get('io');
    if (io) {
      io.to(roomId).emit('chat:message', { message });
    }

    return sendSuccess(res, 201, 'File uploaded', { message });
  } catch (error) {
    next(error);
  }
};

module.exports = { uploadFile };

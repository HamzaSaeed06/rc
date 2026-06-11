const mongoose = require('mongoose');
const { encrypt, decrypt } = require('../utils/encryption');

const messageSchema = new mongoose.Schema(
  {
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['text', 'file', 'system'],
      default: 'text',
    },
    content: {
      type: String,
      trim: true,
      maxlength: [20000, 'Message too long'],
      set: (val) => (val ? encrypt(val) : val),
      get: (val) => (val ? decrypt(val) : val),
    },
    file: {
      originalName: String,
      fileName: String,
      mimeType: String,
      size: Number,
      url: String,
    },
    reactions: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        emoji: {
          type: String,
          required: true,
        },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: {
      getters: true,
      transform(doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
    toObject: { getters: true },
  }
);

const Message = mongoose.model('Message', messageSchema);

// ─── Compound index for fast history queries ───────────────────────────────────
messageSchema.index({ room: 1, createdAt: 1 });

module.exports = Message;

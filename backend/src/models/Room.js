const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const roomSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Room name is required'],
      trim: true,
      maxlength: [100, 'Room name cannot exceed 100 characters'],
    },
    roomId: {
      type: String,
      required: true,
      unique: true,
    },
    host: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    participants: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        joinedAt: { type: Date, default: Date.now },
        socketId: { type: String },
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    maxParticipants: {
      type: Number,
      default: 10,
    },
    isPrivate: {
      type: Boolean,
      default: false,
    },
    password: {
      type: String,
      select: false,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    whiteboardDrawings: {
      type: [{ type: mongoose.Schema.Types.Mixed }],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Hash room password before saving
roomSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
roomSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return true;
  return bcrypt.compare(candidatePassword, this.password);
};

const Room = mongoose.model('Room', roomSchema);
module.exports = Room;

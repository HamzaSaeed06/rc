/**
 * room.service.js
 *
 * Room operations — all mutations use atomic updateOne/$set/$push/$pull
 * to avoid Mongoose VersionError (no .save() on arrays).
 */

const Room = require('../models/Room');

// ─── Get Room ─────────────────────────────────────────────────────────────────

const getRoom = async (roomId) => {
  return Room.findOne({ roomId, isActive: true });
};

const getRoomWithParticipants = async (roomId) => {
  return Room.findOne({ roomId }).populate('participants.user', 'name avatar _id');
};

// ─── Add Participant (atomic) ─────────────────────────────────────────────────

const addParticipant = async (roomId, userId, socketId) => {
  const room = await getRoom(roomId);
  if (!room) throw new Error('Room not found');

  if (room.participants.length >= room.maxParticipants) {
    throw new Error('Room is full');
  }

  const alreadyIn = room.participants.some(
    (p) => p.user.toString() === userId.toString()
  );

  if (!alreadyIn) {
    await Room.updateOne(
      { roomId },
      { $push: { participants: { user: userId, socketId } } }
    );
  }

  return getRoomWithParticipants(roomId);
};

// ─── Remove Participant (atomic) ──────────────────────────────────────────────

const removeParticipant = async (roomId, userId) => {
  const room = await getRoom(roomId);
  if (!room) return null;

  // Atomic remove
  await Room.updateOne(
    { roomId },
    { $pull: { participants: { user: userId } } }
  );

  // Re-fetch after update
  const updatedRoom = await Room.findOne({ roomId });
  if (!updatedRoom) return null;

  // Auto-end when empty (if enabled)
  if (updatedRoom.autoEndWhenEmpty && updatedRoom.participants.length === 0) {
    return { room: updatedRoom, newHost: null, emptyNow: true };
  }

  // Auto-promote host if the host just left
  const isHostLeaving = updatedRoom.host.toString() === userId.toString();

  if (isHostLeaving && updatedRoom.participants.length > 0) {
    const nextHostUserId = updatedRoom.participants[0].user;
    await Room.updateOne({ roomId }, { $set: { host: nextHostUserId } });

    const populated = await Room.findOne({ roomId }).populate('host', 'name email avatar');
    return { room: populated, newHost: populated.host };
  }

  return { room: updatedRoom, newHost: null };
};

// ─── Change Host (atomic, findOneAndUpdate → no VersionError) ─────────────────

const changeHost = async (roomId, currentHostId, newHostId) => {
  // Verify current host and new host presence atomically
  const room = await Room.findOneAndUpdate(
    {
      roomId,
      host: currentHostId,
      'participants.user': newHostId,
    },
    { $set: { host: newHostId } },
    { new: true }
  ).populate('host', 'name email avatar');

  if (!room) throw new Error('Host transfer failed — check permissions and that new host is in room');
  return room;
};

// ─── Whiteboard ───────────────────────────────────────────────────────────────

const addWhiteboardDrawing = async (roomId, drawData) => {
  return Room.updateOne({ roomId }, { $push: { whiteboardDrawings: drawData } });
};

const clearWhiteboard = async (roomId) => {
  return Room.updateOne({ roomId }, { $set: { whiteboardDrawings: [] } });
};

module.exports = {
  getRoom,
  getRoomWithParticipants,
  addParticipant,
  removeParticipant,
  changeHost,
  addWhiteboardDrawing,
  clearWhiteboard,
};

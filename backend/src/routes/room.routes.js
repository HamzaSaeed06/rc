const express = require('express');
const { createRoom, getRooms, getRoomById, endRoom, verifyRoomPassword } = require('../controllers/room.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(protect); // All room routes require auth

router.get('/', getRooms);
router.post('/', createRoom);
router.get('/:roomId', getRoomById);
router.post('/:roomId/verify-password', verifyRoomPassword);
router.patch('/:roomId/end', endRoom);

module.exports = router;

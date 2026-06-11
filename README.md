# SyncSpace — Real-Time Communication App
> CodeAlpha Internship Task 4 | Full Stack Development

A production-ready video conferencing and collaboration platform built with React, Node.js, WebRTC, and Socket.io.

---

## Features

| Feature | Details |
|---|---|
| 🎥 **Multi-user video calling** | WebRTC via simple-peer with STUN servers |
| 🖥️ **Screen sharing** | getDisplayMedia with live track replacement |
| 💬 **Encrypted chat** | AES-256-CBC database encryption on all messages |
| 📁 **File sharing** | Upload files via chat; auto-deleted when room ends |
| 🎨 **Collaborative whiteboard** | Pen, Eraser, Line, Rectangle, Circle tools + PNG export |
| 🔐 **Secure authentication** | JWT access tokens + HttpOnly cookie refresh tokens (XSS-proof) |
| 🔒 **Private rooms** | Password-protected rooms with bcrypt hashing |
| 🎤 **Active speaker detection** | Web Audio API analyser with real-time green glow indicator |
| ♻️ **Auto-cleanup** | Hourly cron job deletes stale rooms, messages, and uploaded files |
| 🛡️ **Security hardening** | Helmet, rate limiting, Mongo sanitization, HPP, CORS |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TailwindCSS, Zustand |
| Backend | Node.js, Express.js |
| Real-time | Socket.io, WebRTC (simple-peer) |
| Database | MongoDB (Mongoose) |
| Auth | JWT (access + HttpOnly refresh cookie), bcryptjs |
| Encryption | Node.js `crypto` — AES-256-CBC |

---

## Project Structure

```
CodeAlpha_RealtimeComm/
├── backend/
│   ├── src/
│   │   ├── config/         # DB connection
│   │   ├── controllers/    # auth, room, file route handlers
│   │   ├── middleware/     # JWT protect, error handler, multer upload
│   │   ├── models/         # User, Room, Message (Mongoose schemas)
│   │   ├── routes/         # Express routers
│   │   ├── services/       # jwt.service, socket.service
│   │   ├── utils/          # logger, AppError, apiResponse, encryption
│   │   ├── validators/     # Joi validators
│   │   ├── app.js          # Express app setup + middleware stack
│   │   └── server.js       # HTTP + Socket.io entry + cleanup cron
│   └── tests/
└── frontend/
    └── src/
        ├── components/
        │   ├── features/   # VideoTile, ChatPanel, Whiteboard
        │   ├── layout/     # ProtectedRoute
        │   └── ui/
        ├── hooks/          # useWebRTC, useAudioAnalyser
        ├── pages/          # LoginPage, RegisterPage, DashboardPage, RoomPage
        ├── services/       # axios instance (api.js), socket singleton
        └── store/          # Zustand auth store
```

---

## Setup & Run

### Prerequisites
- Node.js 18+
- MongoDB Atlas URI (or local MongoDB)

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your values (see Environment Variables below)
npm run dev
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

App runs at **http://localhost:5173**, API at **http://localhost:5000**

---

## Environment Variables

### Backend (`backend/.env`)

```env
NODE_ENV=development
PORT=5000

# MongoDB connection string
MONGO_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/dbname

# JWT — use strong random secrets (32+ chars)
JWT_SECRET=<your-access-token-secret>
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=<your-refresh-token-secret>
JWT_REFRESH_EXPIRES_IN=30d

# CORS — frontend origin
CLIENT_URL=http://localhost:5173

# File uploads
MAX_FILE_SIZE=10485760
UPLOAD_PATH=uploads/
```

### Frontend (`frontend/.env`)

```env
VITE_API_URL=http://localhost:5000/api/v1
VITE_SOCKET_URL=http://localhost:5000
```

---

## API Endpoints

```
POST  /api/v1/auth/register
POST  /api/v1/auth/login
POST  /api/v1/auth/refresh-token      # Cookie-based — no body required
POST  /api/v1/auth/logout
GET   /api/v1/auth/me

GET   /api/v1/rooms
POST  /api/v1/rooms
GET   /api/v1/rooms/:roomId
POST  /api/v1/rooms/:roomId/verify-password
PATCH /api/v1/rooms/:roomId/end

POST  /api/v1/files/upload

GET   /api/health
```

---

## Socket Events

| Event | Direction | Description |
|---|---|---|
| `room:join` | Client → Server | Join a room |
| `room:leave` | Client → Server | Leave a room |
| `room:participants` | Server → Client | Existing participants list |
| `room:user-joined` | Server → Client | New user joined notification |
| `room:user-left` | Server → Client | User left notification |
| `webrtc:offer` | Client ↔ Client | WebRTC SDP offer (relayed via server) |
| `webrtc:answer` | Client ↔ Client | WebRTC SDP answer (relayed via server) |
| `webrtc:ice-candidate` | Client ↔ Client | ICE candidate (relayed via server) |
| `screen:start` | Client → Room | Screen share started |
| `screen:stop` | Client → Room | Screen share stopped |
| `chat:message` | Client ↔ Room | Send/receive chat message |
| `chat:history` | Server → Client | Last 50 messages on room join |
| `whiteboard:draw` | Client ↔ Room | Draw stroke/shape event |
| `whiteboard:clear` | Client ↔ Room | Clear canvas |
| `whiteboard:history` | Server → Client | Replay stored drawings on join |
| `media:toggle` | Client → Room | Mic/camera toggle notification |

---

## Security Architecture

- **Access token** (7d TTL) — stored in `localStorage`, sent as `Authorization: Bearer` header
- **Refresh token** (30d TTL) — stored in `HttpOnly; Secure; SameSite=Lax` cookie, never accessible to JavaScript
- **Token rotation** — new refresh token issued on every `/refresh-token` call
- **Chat messages** — encrypted with AES-256-CBC before MongoDB storage; decrypted transparently via Mongoose getters
- **Room passwords** — bcrypt-hashed (cost 12) before storage; verified with `bcrypt.compare`
- **Rate limiting** — 20 req/15min on auth routes, 200 req/15min on general routes

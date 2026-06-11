---
name: Embedded MongoDB for dev
description: backend/src/config/database.js falls back to mongodb-memory-server when MONGO_URI env var is missing
---

When MONGO_URI is not set, connectDB() auto-starts an embedded MongoDB using `mongodb-memory-server` (installed as devDependency). This lets the backend start immediately without any external database.

**Why:** Replit has no local mongod binary; users often don't have a MongoDB Atlas URI handy during dev.

**How to apply:** Always keep mongodb-memory-server in backend devDependencies. For production deployments, set MONGO_URI as a Replit Secret or environment variable — the embedded server is ephemeral (data lost on restart).

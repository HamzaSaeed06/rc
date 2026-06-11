---
name: Rate limiter and trust proxy fix for Replit
description: express-rate-limit needs trust proxy set and should be skipped in dev on Replit
---

On Replit, all traffic comes through a reverse proxy that sets X-Forwarded-For. Without `app.set('trust proxy', 1)`, express-rate-limit throws a validation error and returns 429 on the first few requests.

**Why:** Replit's proxy architecture always injects X-Forwarded-For headers.

**How to apply:**
1. Add `app.set('trust proxy', 1)` before middleware in app.js
2. Add `skip: () => process.env.NODE_ENV !== 'production'` to all rateLimit() configs so dev is never blocked

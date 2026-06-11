---
name: JWT dev fallback secrets
description: jwt.service.js uses hardcoded dev defaults when JWT_SECRET/JWT_REFRESH_SECRET are not set
---

In jwt.service.js, constants fall back to safe dev-only strings:
```
const ACCESS_SECRET = process.env.JWT_SECRET || 'syncspace_dev_access_secret_change_in_production';
```

**Why:** Replit Secrets (JWT_SECRET, JWT_REFRESH_SECRET) were not provided; without fallbacks jwt.sign() throws and auth completely breaks.

**How to apply:** For production deployments, always set JWT_SECRET and JWT_REFRESH_SECRET as Replit Secrets with strong random values.

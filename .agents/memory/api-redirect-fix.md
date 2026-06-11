---
name: API axios interceptor redirect loop fix
description: The 401 interceptor in frontend/src/services/api.js must not redirect to /login when already on /login or /register
---

The axios response interceptor in api.js tries to refresh the token on 401, then falls back to `window.location.href = '/login'`. If the user is already on `/login`, this causes an infinite reload loop: initialize() → 401 → refresh fails → redirect to /login → reload → repeat.

**Why:** authStore.initialize() calls GET /auth/me on every mount. On /login with no token it always 401s. The hard redirect causes a full page reload, re-triggering initialize().

**How to apply:**
```js
} catch {
  localStorage.removeItem('accessToken');
  const path = window.location.pathname;
  if (!path.startsWith('/login') && !path.startsWith('/register')) {
    window.location.href = '/login';
  }
}
```

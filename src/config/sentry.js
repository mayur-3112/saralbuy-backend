import * as Sentry from '@sentry/node';

// Inert until SENTRY_DSN is set — same "degrade gracefully when unconfigured"
// pattern already used for Redis/ImageKit in this codebase. Safe to import
// and call in every environment, including local dev and CI, with no DSN.
const dsn = process.env.SENTRY_DSN;

// Request bodies for OTP/auth/verification endpoints carry phone numbers,
// OTP codes, GSTIN/PAN, and passwords — none of that should leave the
// process unredacted just because a request happened to fail nearby.
const SENSITIVE_KEYS = ['otp', 'pno', 'phone', 'gstin', 'pan', 'password', 'authtoken', 'admintoken', 'token'];

function redactSensitiveKeys(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  for (const key of Object.keys(obj)) {
    if (SENSITIVE_KEYS.includes(key.toLowerCase())) {
      obj[key] = '[Redacted]';
    } else if (typeof obj[key] === 'object') {
      redactSensitiveKeys(obj[key]);
    }
  }
  return obj;
}

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request) {
        delete event.request.cookies;
        if (event.request.headers) {
          delete event.request.headers.cookie;
          delete event.request.headers.authorization;
        }
        redactSensitiveKeys(event.request.data);
      }
      redactSensitiveKeys(event.extra);
      return event;
    },
  });
  console.log('Sentry initialized');
} else {
  console.warn('[WARN] SENTRY_DSN is not set — error tracking is disabled.');
}

export default Sentry;
export const sentryEnabled = Boolean(dsn);

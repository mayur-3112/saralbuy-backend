import * as Sentry from '@sentry/node';

// Inert until SENTRY_DSN is set — same "degrade gracefully when unconfigured"
// pattern already used for Redis/ImageKit in this codebase. Safe to import
// and call in every environment, including local dev and CI, with no DSN.
const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,
  });
  console.log('Sentry initialized');
} else {
  console.warn('[WARN] SENTRY_DSN is not set — error tracking is disabled.');
}

export default Sentry;
export const sentryEnabled = Boolean(dsn);

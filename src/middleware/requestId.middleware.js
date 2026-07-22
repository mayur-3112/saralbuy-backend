import crypto from 'crypto';

// Correlation ID for tracing a single request across logs and Sentry.
// Reuses an incoming X-Request-Id if the frontend already generated one
// (see frontend_v2/src/helper/instance.js) so the SAME id ties together a
// frontend error, this backend's log line, and a backend Sentry event for
// one logical request — rather than three unrelated identifiers.
const requestId = (req, res, next) => {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
};

export default requestId;

import morgan from 'morgan';
import logger from '../middleware/logger.middleware.js';

const stream = {
  write: message => logger.info(message.trim()),
};

// Custom token surfacing the correlation ID (set by requestId.middleware.js,
// which must run before this) at the front of every HTTP log line — the
// difference between "grep and hope" and "search by ID" when tracing a
// specific request.
morgan.token('reqId', req => req.id || '-');

// Same fields as morgan's built-in 'combined' format, with :reqId prepended
// — preserves the existing log shape rather than inventing a new one.
const morganMiddleware = morgan(
  ':reqId :remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"',
  { stream }
);
export default morganMiddleware;

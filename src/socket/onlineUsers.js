// Presence tracking, multi-tab-safe.
//
// A user can have more than one socket open (multiple tabs/devices), so
// "online" is tracked as a set of live socket ids per user, not a single
// id. Going offline is debounced with a short grace window
// (OFFLINE_GRACE_MS) so a page refresh or a momentary network blip (the
// old socket disconnects, a new one reconnects a second later) doesn't
// flicker the presence indicator to Offline and back.
//
// A heartbeat is layered on top of Socket.IO's own connect/disconnect
// lifecycle: a tab that's open but backgrounded/frozen (laptop sleep, a
// suspended mobile tab) can hold a technically-alive socket long past the
// point a human would call the user "online". If a socket stops sending
// heartbeats, it's swept and treated as offline even though `disconnect`
// never fired for it.

export const userSockets = new Map(); // userId -> Set<socketId>
export const lastHeartbeat = new Map(); // socketId -> timestamp (ms)
const offlineTimers = new Map(); // userId -> Timeout

export const OFFLINE_GRACE_MS = 10_000; // survive a quick refresh/reconnect
export const HEARTBEAT_INTERVAL_MS = 20_000; // client cadence
export const HEARTBEAT_TIMEOUT_MS = 60_000; // 3 missed beats -> stale

// Backward-compat shim: bid.service.js / earlier code reads onlineUsers as
// a Map<userId, socketId> (single id) to target a socket with io.to(...).
// Real presence now lives in userSockets (a Set per user); this proxy keeps
// that single-id read path working by handing back any one live socket id.
export const onlineUsers = {
  get(userId) {
    const set = userSockets.get(userId?.toString());
    if (!set || set.size === 0) return undefined;
    return set.values().next().value;
  },
  has(userId) {
    const set = userSockets.get(userId?.toString());
    return !!set && set.size > 0;
  },
  delete(userId) {
    userSockets.delete(userId?.toString());
  },
};

export function addSocket(userId, socketId) {
  const uid = userId.toString();
  const existingTimer = offlineTimers.get(uid);
  if (existingTimer) {
    clearTimeout(existingTimer);
    offlineTimers.delete(uid);
  }
  if (!userSockets.has(uid)) userSockets.set(uid, new Set());
  userSockets.get(uid).add(socketId);
  lastHeartbeat.set(socketId, Date.now());
}

export function touchHeartbeat(socketId) {
  lastHeartbeat.set(socketId, Date.now());
}

// Removes one socket from a user's presence set. If that was the user's
// last live socket, schedules the actual "go offline" after the grace
// window rather than immediately, and returns the info the caller needs
// to know whether/when to broadcast an offline status + persist lastSeen.
export function removeSocket(userId, socketId, onGoOffline) {
  const uid = userId.toString();
  lastHeartbeat.delete(socketId);
  const set = userSockets.get(uid);
  if (!set) return;
  set.delete(socketId);
  if (set.size > 0) return; // other tabs still open — stays online

  userSockets.delete(uid);
  const timer = setTimeout(() => {
    offlineTimers.delete(uid);
    // Only fire if the user hasn't reconnected during the grace window.
    if (!userSockets.has(uid)) onGoOffline(uid);
  }, OFFLINE_GRACE_MS);
  offlineTimers.set(uid, timer);
}

export function isOnline(userId) {
  const set = userSockets.get(userId?.toString());
  return !!set && set.size > 0;
}

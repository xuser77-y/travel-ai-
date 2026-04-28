/**
 * In-memory tracker of currently connected sockets.
 *
 * We key by socket id so the same user opening two tabs counts as two
 * connections (and one online user via the userId index).
 *
 * Schema:
 *   sockets: Map<socketId, { socketId, userId|null, name, ip, userAgent, since }>
 *
 * The map lives only in memory — it resets on every server restart, which is
 * exactly what we want for an "online right now" view.
 */

const sockets = new Map();

const sanitizeIp = (ip) => {
  if (!ip) return '';
  // Strip the IPv6-mapped IPv4 prefix that Node sometimes returns.
  return String(ip).replace(/^::ffff:/, '');
};

const register = (socket, meta = {}) => {
  const ip =
    sanitizeIp(socket.handshake?.headers?.['x-forwarded-for']?.split(',')[0]?.trim()) ||
    sanitizeIp(socket.handshake?.address) ||
    sanitizeIp(socket.conn?.remoteAddress);
  const userAgent = socket.handshake?.headers?.['user-agent'] || '';

  sockets.set(socket.id, {
    socketId: socket.id,
    userId: meta.userId || null,
    name: meta.name || 'Guest',
    ip,
    userAgent,
    since: new Date()
  });
};

const identify = (socketId, { userId, name }) => {
  const entry = sockets.get(socketId);
  if (!entry) return;
  if (userId) entry.userId = String(userId);
  if (name) entry.name = name;
  sockets.set(socketId, entry);
};

const remove = (socketId) => {
  sockets.delete(socketId);
};

// All connected sockets, newest first.
const list = () =>
  Array.from(sockets.values()).sort((a, b) => b.since - a.since);

// Distinct online userIds (logged-in users only).
const onlineUserIds = () => {
  const ids = new Set();
  for (const s of sockets.values()) {
    if (s.userId) ids.add(s.userId);
  }
  return Array.from(ids);
};

const counts = () => ({
  totalSockets: sockets.size,
  onlineUsers: onlineUserIds().length,
  guests: Array.from(sockets.values()).filter((s) => !s.userId).length
});

module.exports = {
  register,
  identify,
  remove,
  list,
  onlineUserIds,
  counts
};

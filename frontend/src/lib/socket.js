import { io } from 'socket.io-client';

/**
 * Singleton Socket.IO client — one connection per browser tab.
 *
 * Pages that want realtime updates import `socket` from here instead of
 * calling `io()` themselves; this keeps the admin's "online users" count
 * accurate (1 connection per tab, not per page-mount).
 *
 * `identifySocket(user)` should be called whenever the auth state changes
 * so the backend can associate the socket with a real user account.
 */

const API = 'http://localhost:5000';

// The JWT is read once at boot — `setAuthToken()` reconnects when it
// changes (login / logout) so the backend can plan-gate socket events.
const initialToken = (() => {
  try { return localStorage.getItem('travio_token') || null; } catch (_) { return null; }
})();

export const socket = io(API, {
  autoConnect: true,
  transports: ['websocket', 'polling'],
  auth: { token: initialToken }
});

export const identifySocket = (user) => {
  socket.emit('identify', {
    userId: user?.id || user?._id || null,
    name: user?.name || 'Guest'
  });
};

// Re-emit identify after every (re)connect so transient drops don't lose
// the userId association on the server side.
let lastIdentity = null;
socket.on('connect', () => {
  if (lastIdentity) socket.emit('identify', lastIdentity);
});

export const setIdentity = (identity) => {
  lastIdentity = identity;
  socket.emit('identify', identity);
};

// Reconnects with the new JWT in the handshake so the backend's
// `userFromSocket` can resolve the right user. Called on login + logout.
export const setAuthToken = (token) => {
  socket.auth = { token: token || null };
  if (socket.connected) socket.disconnect();
  socket.connect();
};

export default socket;

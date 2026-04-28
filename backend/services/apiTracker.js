/**
 * Lightweight in-memory API usage tracker.
 *
 * Hooks into Express via the `middleware()` factory and:
 *   - increments per-route counters (method + normalized path)
 *   - keeps a ring buffer of the last N requests (default 200)
 *   - tracks per-status counts and total bytes when available
 *
 * Resets on server restart by design (this is an *operational* view, not
 * an audit log). For long-term retention, ship the buffer to MongoDB or
 * an external sink — out of scope here.
 */

const RING_SIZE = 200;
const ring = []; // { ts, method, path, status, ms, ip, user }
const counters = new Map(); // key=`${method} ${path}` => { count, totalMs, errors }
const statusCounts = new Map();
let totalRequests = 0;
let startedAt = Date.now();

const incCounter = (key, ms, status) => {
  const cur = counters.get(key) || { count: 0, totalMs: 0, errors: 0 };
  cur.count += 1;
  cur.totalMs += ms;
  if (status >= 400) cur.errors += 1;
  counters.set(key, cur);
};

const incStatus = (status) => {
  const k = `${Math.floor(status / 100)}xx`;
  statusCounts.set(k, (statusCounts.get(k) || 0) + 1);
};

const middleware = () => (req, res, next) => {
  const started = Date.now();
  res.on('finish', () => {
    try {
      // Only record API calls — skip the SPA assets, root health-check, etc.
      if (!req.originalUrl || !req.originalUrl.startsWith('/api/')) return;

      // Normalize ObjectIds and uuids so /api/trips/507f… and /api/trips/abc
      // collapse to the same bucket. Any 24-hex chunk becomes :id.
      const normalized = req.originalUrl
        .split('?')[0]
        .replace(/\/[a-f0-9]{24}(?=\/|$)/gi, '/:id')
        .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:uuid');

      const key = `${req.method} ${normalized}`;
      const ms = Date.now() - started;
      incCounter(key, ms, res.statusCode);
      incStatus(res.statusCode);
      totalRequests += 1;

      const entry = {
        ts: new Date(),
        method: req.method,
        path: normalized,
        status: res.statusCode,
        ms,
        ip: req.ip || '',
        user: req.user?.id || null
      };
      ring.push(entry);
      if (ring.length > RING_SIZE) ring.shift();
    } catch {
      /* never let logging break a request */
    }
  });
  next();
};

const summary = () => {
  // Top routes sorted by hit count.
  const top = Array.from(counters.entries())
    .map(([key, v]) => {
      const [method, path] = key.split(' ');
      return {
        method,
        path,
        count: v.count,
        avgMs: v.count ? Math.round(v.totalMs / v.count) : 0,
        errors: v.errors
      };
    })
    .sort((a, b) => b.count - a.count);

  const status = {};
  for (const [k, v] of statusCounts.entries()) status[k] = v;

  return {
    totalRequests,
    uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
    status,
    routes: top,
    recent: ring.slice().reverse()
  };
};

const reset = () => {
  ring.length = 0;
  counters.clear();
  statusCounts.clear();
  totalRequests = 0;
  startedAt = Date.now();
};

module.exports = { middleware, summary, reset };

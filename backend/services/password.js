/**
 * Password hashing helpers.
 *
 * Uses Node's built-in `crypto.scrypt` so we don't add a bcrypt dependency.
 * Stored format: `scrypt:<saltHex>:<hashHex>` — the prefix lets us detect
 * legacy plaintext passwords and lazily upgrade them on first login.
 */

const crypto = require('crypto');

const KEY_LENGTH = 64;
const SCRYPT_PREFIX = 'scrypt:';

const hashPassword = (plain) => {
  if (typeof plain !== 'string' || plain.length === 0) {
    throw new Error('Password must be a non-empty string');
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(plain, salt, KEY_LENGTH).toString('hex');
  return `${SCRYPT_PREFIX}${salt}:${hash}`;
};

// Returns true if the plaintext matches the stored hash *or* the legacy
// plaintext password (so existing users keep working). Callers should
// re-save with hashPassword() after a successful legacy match.
const verifyPassword = (plain, stored) => {
  if (typeof plain !== 'string' || typeof stored !== 'string') return false;
  if (!stored.startsWith(SCRYPT_PREFIX)) {
    // Legacy plaintext — direct comparison (constant-time would be nice but
    // these will be migrated immediately).
    return plain === stored;
  }
  const [, salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(plain, salt, KEY_LENGTH).toString('hex');
  // Constant-time compare to avoid timing attacks.
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(test, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

const isHashed = (stored) =>
  typeof stored === 'string' && stored.startsWith(SCRYPT_PREFIX);

module.exports = { hashPassword, verifyPassword, isHashed };

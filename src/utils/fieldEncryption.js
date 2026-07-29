import crypto from 'crypto';

// Field-level encryption for GSTIN/PAN (plaintext storage was a flagged
// audit finding — see legal/data-inventory.md). Same "degrade gracefully
// when unconfigured" pattern as Redis/ImageKit/Sentry elsewhere in this
// codebase: with no key set, these functions are a no-op passthrough, so
// local dev and any environment without FIELD_ENCRYPTION_KEY keeps working
// exactly as before — only a configured production key actually encrypts.
const KEY_ENV = process.env.FIELD_ENCRYPTION_KEY;

function getKey() {
  if (!KEY_ENV) return null;
  // 64-char hex = a real 32-byte AES-256 key; anything else gets hashed down
  // to 32 bytes so ops can set a plain passphrase without generating hex.
  if (/^[0-9a-fA-F]{64}$/.test(KEY_ENV)) return Buffer.from(KEY_ENV, 'hex');
  return crypto.createHash('sha256').update(KEY_ENV).digest();
}

const ALGO = 'aes-256-cbc';
const PREFIX = 'ENC1';

export function isFieldEncryptionConfigured() {
  return Boolean(getKey());
}

// Deterministic: the IV is derived from HMAC(key, plaintext), so identical
// plaintext always produces identical ciphertext. This is a deliberate
// trade-off, not an oversight — the app relies on exact-match GSTIN lookups
// (duplicate-GSTIN detection in user.controller.js) that would break under
// standard random-IV encryption. Deterministic encryption reveals that two
// records share the same underlying value, but not the value itself, which
// is adequate against the actual threat this closes: a DB dump or backup
// exposing GSTIN/PAN in plaintext at rest.
export function encryptField(plaintext) {
  const key = getKey();
  if (!key || plaintext === null || plaintext === undefined || plaintext === '') return plaintext;
  const str = String(plaintext);
  if (str.startsWith(`${PREFIX}:`)) return str; // already encrypted, don't double-wrap
  const iv = crypto.createHmac('sha256', key).update(str).digest().subarray(0, 16);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(str, 'utf8'), cipher.final()]);
  return `${PREFIX}:${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

// Existing plaintext records (written before this key was configured, or
// while it's unconfigured) pass through unchanged — this is intentionally
// tolerant so no backfill migration is required to ship this safely. A
// separate, explicit backfill (re-saving each user to encrypt their
// existing GSTIN/PAN) is a follow-up, tracked in Roadmap.md, not done here.
export function decryptField(stored) {
  const key = getKey();
  if (!key || typeof stored !== 'string' || !stored.startsWith(`${PREFIX}:`)) return stored;
  try {
    const [, ivHex, dataHex] = stored.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    console.error('Field decryption failed, returning raw stored value:', err.message);
    return stored;
  }
}

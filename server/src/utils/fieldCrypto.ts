import crypto from 'crypto';

export interface KeyRingEntry {
  version: string;
  key: Buffer;
}

// Global in-memory keyring
let keyRingCache: Map<string, Buffer> | null = null;
let activeVersionCache: string | null = null;

/**
 * Normalizes version string by removing leading 'v' if present (e.g., 'v1' -> '1')
 */
export function normalizeVersion(v: string): string {
  return v.replace(/^v/i, '').trim();
}

/**
 * Parses key ring from comma-separated (e.g. 'v1:<base64-32-bytes>,v2:...')
 * or JSON string (e.g. '{"v1":"<base64-32-bytes>"}').
 * Returns a map with both normalized ('1') and prefixed ('v1') keys for resilience.
 */
export function parseKeyRing(keysString?: string): Map<string, Buffer> {
  const map = new Map<string, Buffer>();
  if (!keysString || !keysString.trim()) {
    return map;
  }

  const trimmed = keysString.trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      for (const [v, b64] of Object.entries(parsed)) {
        if (typeof b64 === 'string') {
          const buf = Buffer.from(b64.trim(), 'base64');
          if (buf.length === 32) {
            const norm = normalizeVersion(v);
            map.set(norm, buf);
            map.set(`v${norm}`, buf);
          }
        }
      }
    } catch {
      // Ignore parse errors; validated at boot
    }
  } else {
    const entries = trimmed.split(',');
    for (const entry of entries) {
      const parts = entry.trim().split(':');
      if (parts.length === 2) {
        const v = parts[0].trim();
        const b64 = parts[1].trim();
        const buf = Buffer.from(b64, 'base64');
        if (buf.length === 32) {
          const norm = normalizeVersion(v);
          map.set(norm, buf);
          map.set(`v${norm}`, buf);
        }
      }
    }
  }

  return map;
}

/**
 * Retrieves the configured keyring or derives an ephemeral key in dev/test mode.
 */
export function getKeyRing(): Map<string, Buffer> {
  if (keyRingCache) {
    return keyRingCache;
  }

  const envKeys = process.env.FIELD_ENCRYPTION_KEYS;
  const parsed = parseKeyRing(envKeys);

  if (parsed.size > 0) {
    keyRingCache = parsed;
    return keyRingCache;
  }

  // Fallback for development and testing: ephemeral in-memory 32-byte key
  const ephemeral = crypto.randomBytes(32);
  const fallbackMap = new Map<string, Buffer>();
  fallbackMap.set('1', ephemeral);
  fallbackMap.set('v1', ephemeral);

  if (process.env.NODE_ENV !== 'test') {
    console.warn(
      '[fieldCrypto] FIELD_ENCRYPTION_KEYS not configured. Generated ephemeral key for v1. Encrypted data will not be recoverable across server restarts.'
    );
  }

  keyRingCache = fallbackMap;
  return keyRingCache;
}

/**
 * Returns the currently active encryption key version (normalized without leading 'v').
 */
export function getActiveKeyVersion(): string {
  if (activeVersionCache) {
    return activeVersionCache;
  }

  const envActive = process.env.FIELD_ENCRYPTION_ACTIVE_VERSION;
  if (envActive && envActive.trim()) {
    activeVersionCache = normalizeVersion(envActive);
    return activeVersionCache;
  }

  activeVersionCache = '1';
  return activeVersionCache;
}

/**
 * Override the keyring and active version for testing key rotation and migrations.
 */
export function setKeyRingForTesting(keys: Map<string, Buffer>, activeVersion = '1'): void {
  keyRingCache = new Map(keys);
  activeVersionCache = normalizeVersion(activeVersion);
}

/**
 * Resets the in-memory keyring cache to re-read from environment variables.
 */
export function resetKeyRing(): void {
  keyRingCache = null;
  activeVersionCache = null;
}

/**
 * Checks if a stored value matches the AES-256-GCM encrypted format:
 * 'enc:v<version>:<ivBase64url>:<tagBase64url>:<cipherBase64url>'
 */
export function isEncrypted(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  return /^enc:v[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+$/.test(value);
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 *
 * @param plain - The plaintext string to encrypt.
 * @param context - Optional Additional Authenticated Data (AAD) binding to field (e.g. 'User.addresses.line1').
 * @returns Encrypted string formatted as 'enc:v<version>:<ivBase64url>:<tagBase64url>:<cipherBase64url>'.
 */
export function encryptField(plain: string, context?: string): string {
  if (plain === null || plain === undefined) {
    return plain as unknown as string;
  }

  const keyRing = getKeyRing();
  const activeVer = getActiveKeyVersion();
  const key = keyRing.get(activeVer) || keyRing.get(`v${activeVer}`);

  if (!key || key.length !== 32) {
    throw new Error(`Active encryption key version 'v${activeVer}' is not configured or invalid.`);
  }

  // 12-byte random IV per write operation
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  // Bind-to-field AAD context
  if (context) {
    cipher.setAAD(Buffer.from(context, 'utf8'));
  }

  const ciphertext = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag(); // 16 bytes

  return `enc:v${activeVer}:${iv.toString('base64url')}:${tag.toString('base64url')}:${ciphertext.toString('base64url')}`;
}

/**
 * Decrypts an encrypted field value using AES-256-GCM.
 * Non-encrypted values are returned unchanged to support legacy plaintext during migration.
 *
 * @param stored - The value to decrypt.
 * @param context - Optional Additional Authenticated Data (AAD) binding (must match the context used during encryption).
 * @returns Decrypted plaintext string.
 * @throws Error if ciphertext/tag has been tampered with or context mismatches.
 */
export function decryptField(stored: string, context?: string): string {
  if (stored === null || stored === undefined) {
    return stored as unknown as string;
  }

  // If not encrypted, return unchanged to preserve legacy data
  if (!isEncrypted(stored)) {
    return stored;
  }

  const parts = stored.split(':');
  if (parts.length !== 5 || parts[0] !== 'enc') {
    return stored;
  }

  const versionTag = parts[1]; // e.g. 'v1'
  const keyVersion = normalizeVersion(versionTag);
  const ivB64url = parts[2];
  const tagB64url = parts[3];
  const cipherB64url = parts[4];

  const keyRing = getKeyRing();
  const key = keyRing.get(keyVersion) || keyRing.get(`v${keyVersion}`);

  if (!key || key.length !== 32) {
    throw new Error(`Decryption key version '${versionTag}' not found in key ring.`);
  }

  const iv = Buffer.from(ivB64url, 'base64url');
  const tag = Buffer.from(tagB64url, 'base64url');
  const ciphertext = Buffer.from(cipherB64url, 'base64url');

  if (iv.length !== 12 || tag.length !== 16) {
    throw new Error('Invalid encryption payload structure (IV or tag length mismatch).');
  }

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  if (context) {
    decipher.setAAD(Buffer.from(context, 'utf8'));
  }

  try {
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    throw new Error('Decryption failed: authentication tag mismatch or corrupted ciphertext.');
  }
}

/**
 * Checks whether an encrypted string was encrypted under an older key version
 * and should be re-encrypted under the active version.
 */
export function needsReencryption(stored: string): boolean {
  if (!isEncrypted(stored)) {
    return false;
  }
  const parts = stored.split(':');
  if (parts.length !== 5) {
    return false;
  }
  const version = normalizeVersion(parts[1]);
  return version !== getActiveKeyVersion();
}


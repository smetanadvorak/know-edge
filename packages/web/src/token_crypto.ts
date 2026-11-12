/**
 * Encrypts the GitHub token with a passphrase before it goes to local storage.
 * key: PBKDF2-SHA256 (600k iterations, random salt) -> AES-GCM 256, random iv.
 * the decrypted token lives only in memory.
 *
 * prompt:
 *   how is token handled and stored?
 *   yes (encrypt the token with a passphrase + "forget token" button)
 */

export interface EncryptedToken
{
  salt: string;
  iv: string;
  data: string;
  iterations: number;
}

const ITERATIONS = 600_000;

function toBase64(bytes: Uint8Array): string
{
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromBase64(b64: string): Uint8Array<ArrayBuffer>
{
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey>
{
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptToken(token: string, passphrase: string): Promise<EncryptedToken>
{
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, ITERATIONS);
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(token));
  return { salt: toBase64(salt), iv: toBase64(iv), data: toBase64(new Uint8Array(data)), iterations: ITERATIONS };
}

// returns null when the passphrase is wrong
export async function decryptToken(enc: EncryptedToken, passphrase: string): Promise<string | null>
{
  const key = await deriveKey(passphrase, fromBase64(enc.salt), enc.iterations);
  // aes-gcm decrypt rejects on a wrong key; that is the only way to detect a wrong passphrase
  try
  {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(enc.iv) }, key, fromBase64(enc.data));
    return new TextDecoder().decode(plain);
  }
  catch
  {
    return null;
  }
}

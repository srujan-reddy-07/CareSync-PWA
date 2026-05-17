const APP_SECRET = 'CareSync-AES256-Secure-2026';
const SALT = 'caresync-pbkdf2-salt-v1';

let _key: CryptoKey | null = null;

async function getDerivedKey(): Promise<CryptoKey> {
  if (_key) return _key;
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(APP_SECRET), 'PBKDF2', false, ['deriveKey']
  );
  _key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode(SALT), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
  return _key;
}

export async function secureSet(key: string, data: unknown): Promise<void> {
  try {
    const k = await getDerivedKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(JSON.stringify(data));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, encoded);
    const combined = new Uint8Array(12 + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), 12);
    const b64 = btoa(String.fromCharCode(...combined));
    localStorage.setItem(`enc::${key}`, b64);
  } catch { /* silent fail — data still in memory */ }
}

export async function secureGet<T>(key: string, fallback: T): Promise<T> {
  const raw = localStorage.getItem(`enc::${key}`);
  if (!raw) {
    // Migrate from unencrypted legacy key if present
    const legacy = localStorage.getItem(key);
    if (legacy) {
      try {
        const parsed = JSON.parse(legacy) as T;
        await secureSet(key, parsed);
        localStorage.removeItem(key);
        return parsed;
      } catch { return fallback; }
    }
    return fallback;
  }
  try {
    const k = await getDerivedKey();
    const combined = Uint8Array.from(atob(raw), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, k, data);
    return JSON.parse(new TextDecoder().decode(decrypted)) as T;
  } catch {
    // Decryption failed — try reading as plain JSON fallback
    try { return JSON.parse(raw) as T; } catch { return fallback; }
  }
}

export function secureRemove(key: string) {
  localStorage.removeItem(`enc::${key}`);
  localStorage.removeItem(key);
}

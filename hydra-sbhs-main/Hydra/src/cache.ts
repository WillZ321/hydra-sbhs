interface Entry<T> {
  ts: number;
  ttl: number;
  data: T;
}

export function cacheGet<T>(key: string): T | null {
  const raw = localStorage.getItem(`hydra.cache.${key}`);
  if (!raw) return null;
  try {
    const e: Entry<T> = JSON.parse(raw);
    if (Date.now() - e.ts > e.ttl) return null;
    return e.data;
  } catch {
    return null;
  }
}

export function cacheSet<T>(key: string, data: T, ttlMs: number): void {
  const e: Entry<T> = { ts: Date.now(), ttl: ttlMs, data };
  localStorage.setItem(`hydra.cache.${key}`, JSON.stringify(e));
}

export async function cached<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  const hit = cacheGet<T>(key);
  if (hit) return hit;
  try {
    const fresh = await fetcher();
    cacheSet(key, fresh, ttlMs);
    return fresh;
  } catch (err) {
    // Offline fallback: return any stale cache if present.
    const raw = localStorage.getItem(`hydra.cache.${key}`);
    if (raw) {
      try { return (JSON.parse(raw) as Entry<T>).data; } catch { /* */ }
    }
    throw err;
  }
}

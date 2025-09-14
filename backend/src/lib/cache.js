/**
 * Simple in-memory LRU cache with TTL, no external dependencies.
 * Intended for single-instance deployments. For multi-instance, use a shared cache.
 */

class LruCache {
  constructor(maxEntries = 500, defaultTtlMs = 60_000) {
    this.maxEntries = maxEntries;
    this.defaultTtlMs = defaultTtlMs;
    this.map = new Map(); // key -> { value, expiresAt }
  }

  _now() {
    return Date.now();
  }

  _isExpired(entry) {
    return entry.expiresAt !== 0 && entry.expiresAt <= this._now();
  }

  _touch(key, entry) {
    this.map.delete(key);
    this.map.set(key, entry);
  }

  set(key, value, ttlMs = this.defaultTtlMs) {
    const expiresAt = ttlMs > 0 ? this._now() + ttlMs : 0; // 0 = no expiry
    const entry = { value, expiresAt };
    if (this.map.has(key)) {
      this.map.delete(key);
    }
    this.map.set(key, entry);
    this._evictIfNeeded();
  }

  get(key) {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (this._isExpired(entry)) {
      this.map.delete(key);
      return undefined;
    }
    this._touch(key, entry);
    return entry.value;
  }

  has(key) {
    const entry = this.map.get(key);
    if (!entry) return false;
    if (this._isExpired(entry)) {
      this.map.delete(key);
      return false;
    }
    return true;
  }

  delete(key) {
    return this.map.delete(key);
  }

  deleteByPrefix(prefix) {
    const keysToDelete = [];
    for (const key of this.map.keys()) {
      if (typeof key === 'string' && key.startsWith(prefix)) {
        keysToDelete.push(key);
      }
    }
    for (const k of keysToDelete) this.map.delete(k);
    return keysToDelete.length;
  }

  clear() {
    this.map.clear();
  }

  size() {
    return this.map.size;
  }

  _evictIfNeeded() {
    while (this.map.size > this.maxEntries) {
      // Evict least-recently used (first entry in Map)
      const firstKey = this.map.keys().next().value;
      this.map.delete(firstKey);
    }
  }
}

// Singleton cache instances per domain to avoid key collisions
const caches = {
  posts: new LruCache(1000, 30_000),
  comments: new LruCache(1000, 30_000),
  communities: new LruCache(500, 30_000),
  search: new LruCache(500, 20_000),
  reviews: new LruCache(500, 30_000),
};

module.exports = {
  LruCache,
  caches,
};



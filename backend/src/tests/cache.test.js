const { LruCache } = require('../lib/cache');

describe('LruCache', () => {
  test('set/get works and respects TTL', async () => {
    const cache = new LruCache(10, 50);
    cache.set('a', 1);
    expect(cache.get('a')).toBe(1);
    await new Promise(r => setTimeout(r, 60));
    expect(cache.get('a')).toBeUndefined();
  });

  test('LRU eviction removes oldest', () => {
    const cache = new LruCache(2, 1000);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBe(3);
  });
});



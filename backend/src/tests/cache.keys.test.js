const { LruCache } = require('../lib/cache');

test('deleteByPrefix removes matching keys', () => {
  const cache = new LruCache(10, 1000);
  cache.set('home:user1', 1);
  cache.set('home:user2', 2);
  cache.set('community:abc', 3);
  cache.deleteByPrefix('home:');
  expect(cache.get('home:user1')).toBeUndefined();
  expect(cache.get('home:user2')).toBeUndefined();
  expect(cache.get('community:abc')).toBe(3);
});



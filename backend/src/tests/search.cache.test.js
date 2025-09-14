const { globalSearch } = require('../modules/search/service');

describe('Search caching (cautious)', () => {
  test('does not throw on empty query and returns structure', async () => {
    const res = await globalSearch('', { type: 'all', limit: 1 });
    expect(res).toHaveProperty('posts');
    expect(res).toHaveProperty('communities');
    expect(res).toHaveProperty('users');
    expect(res).toHaveProperty('meta');
  });
});



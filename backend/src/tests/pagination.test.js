const { encodeCursor, decodeCursor } = require('../lib/pagination');

describe('pagination utils', () => {
  test('encode/decode roundtrip', () => {
    const now = new Date();
    const cursor = encodeCursor({ id: 'abc123', createdAt: now });
    const decoded = decodeCursor(cursor);
    expect(decoded).toBeTruthy();
    expect(decoded.id).toBe('abc123');
    expect(decoded.createdAt instanceof Date).toBe(true);
  });

  test('decode invalid returns null', () => {
    expect(decodeCursor('not-base64')).toBeNull();
  });
});



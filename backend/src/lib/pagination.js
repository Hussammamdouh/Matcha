/**
 * Cursor encoding/decoding helpers using createdAt and id.
 */

function encodeCursor(doc) {
  if (!doc) return null;
  const createdAt = doc.createdAt?.toMillis ? doc.createdAt.toMillis() : (doc.createdAt?.getTime?.() || 0);
  return Buffer.from(JSON.stringify({ createdAt, id: doc.id })).toString('base64');
}

function decodeCursor(cursorB64) {
  if (!cursorB64) return null;
  try {
    const { createdAt, id } = JSON.parse(Buffer.from(cursorB64, 'base64').toString('utf8'));
    return { createdAt: new Date(createdAt), id };
  } catch (_) {
    return null;
  }
}

module.exports = {
  encodeCursor,
  decodeCursor,
};



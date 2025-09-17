const { getStorage } = require('../../firebase');

module.exports = {
  async generateUploadUrl(filePath, contentType, expiresIn = 3600) {
    const bucket = getStorage().bucket();
    const file = bucket.file(filePath);
    const [url] = await file.getSignedUrl({ action: 'write', contentType, expires: Date.now() + expiresIn * 1000 });
    return { uploadUrl: url, filePath, contentType, expiresAt: new Date(Date.now() + expiresIn * 1000), method: 'PUT' };
  },
  async generateDownloadUrl(filePath, expiresIn = 3600) {
    const bucket = getStorage().bucket();
    const file = bucket.file(filePath);
    const [exists] = await file.exists();
    if (!exists) throw new Error('File not found');
    const [url] = await file.getSignedUrl({ action: 'read', expires: Date.now() + expiresIn * 1000 });
    const [metadata] = await file.getMetadata();
    return { downloadUrl: url, filePath, contentType: metadata.contentType, size: metadata.size, expiresAt: new Date(Date.now() + expiresIn * 1000) };
  },
  async deleteFile(filePath) {
    const bucket = getStorage().bucket();
    const file = bucket.file(filePath);
    const [exists] = await file.exists();
    if (!exists) return false;
    await file.delete();
    return true;
  },
  async getFileMetadata(filePath) {
    const bucket = getStorage().bucket();
    const file = bucket.file(filePath);
    const [exists] = await file.exists();
    if (!exists) return null;
    const [metadata] = await file.getMetadata();
    return { filePath, contentType: metadata.contentType, size: parseInt(metadata.size), createdAt: metadata.timeCreated, updatedAt: metadata.updated, md5Hash: metadata.md5Hash };
  },
  async fileExists(filePath) {
    const bucket = getStorage().bucket();
    const [exists] = await bucket.file(filePath).exists();
    return exists;
  },
  async getFileSize(filePath) {
    const bucket = getStorage().bucket();
    const [metadata] = await bucket.file(filePath).getMetadata();
    return parseInt(metadata.size);
  },
  async listFiles(directory, options = {}) {
    const bucket = getStorage().bucket();
    const [files, nextPageToken] = await bucket.getFiles({ prefix: directory, maxResults: options.maxResults || 1000, pageToken: options.pageToken });
    return { files: files.map(f => ({ name: f.name, size: f.metadata?.size, contentType: f.metadata?.contentType, createdAt: f.metadata?.timeCreated, updatedAt: f.metadata?.updated })), nextPageToken };
  },
};



const cloudinary = require('cloudinary').v2;

function configureCloudinary() {
  if (!cloudinary.config().cloud_name) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
  }
}

function mapContentTypeToResourceType(contentType) {
  const top = (contentType || '').split('/')[0];
  if (top === 'image') return 'image';
  if (top === 'video' || top === 'audio') return 'video';
  return 'raw';
}

function buildPublicUrl(publicId, resourceType) {
  return cloudinary.url(publicId, { resource_type: resourceType, secure: true });
}

module.exports = {
  async generateUploadUrl(filePath, contentType, expiresInSeconds = 3600) {
    configureCloudinary();
    const resourceType = mapContentTypeToResourceType(contentType);

    // Use filePath as public_id to preserve paths like posts/{postId}/media/{file}
    // Cloudinary folder structure will mirror this public_id
    const ttl = Math.max(60, Math.min(expiresInSeconds, 3600));

    const params = {
      public_id: filePath,
      folder: undefined, // public_id already contains folders
      resource_type: resourceType,
      type: 'upload',
      timestamp: Math.floor(Date.now() / 1000),
      use_filename: true,
      unique_filename: false,
      overwrite: true,
    };

    // Cloudinary signed params for direct upload from client via POST to https://api.cloudinary.com/v1_1/<cloud>/auto/upload
    const signature = cloudinary.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET);

    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudinary.config().cloud_name}/${resourceType}/upload`;
    const expiresAt = new Date(Date.now() + ttl * 1000);

    return {
      // Match Firebase shape from our controllers/service
      uploadUrl,
      filePath,
      contentType,
      expiresAt,
      // Additional fields required by Cloudinary direct upload
      fields: {
        api_key: process.env.CLOUDINARY_API_KEY,
        timestamp: params.timestamp,
        public_id: filePath,
        overwrite: true,
        signature,
      },
      method: 'POST',
    };
  },

  async generateDownloadUrl(filePath, expiresInSeconds = 3600) {
    configureCloudinary();
    const resourceTypeGuess = filePath.match(/\.(mp4|webm|mov|mp3|aac|wav)$/i) ? 'video' : 'image';
    // For simplicity, return signed download URL with expiry
    const url = cloudinary.url(filePath, {
      resource_type: resourceTypeGuess,
      type: 'upload',
      sign_url: true,
      secure: true,
      expires_at: Math.floor(Date.now() / 1000) + Math.max(60, Math.min(expiresInSeconds, 3600)),
    });
    return {
      downloadUrl: url,
      filePath,
      contentType: undefined,
      size: undefined,
      expiresAt: new Date(Date.now() + Math.min(expiresInSeconds, 3600) * 1000),
    };
  },

  async deleteFile(filePath) {
    configureCloudinary();
    try {
      await cloudinary.uploader.destroy(filePath, { resource_type: 'image' }).catch(() => {});
      await cloudinary.uploader.destroy(filePath, { resource_type: 'video' }).catch(() => {});
      await cloudinary.api.delete_resources([filePath], { resource_type: 'raw' }).catch(() => {});
      return true;
    } catch (_) {
      return false;
    }
  },

  async getFileMetadata(filePath) {
    configureCloudinary();
    try {
      const img = await cloudinary.api.resource(filePath, { resource_type: 'image' }).catch(() => null);
      const vid = img ? null : await cloudinary.api.resource(filePath, { resource_type: 'video' }).catch(() => null);
      const raw = img || vid ? null : await cloudinary.api.resource(filePath, { resource_type: 'raw' }).catch(() => null);
      const meta = img || vid || raw;
      if (!meta) return null;
      return {
        filePath,
        contentType: meta.resource_type,
        size: meta.bytes,
        createdAt: new Date(meta.created_at).toISOString(),
        updatedAt: new Date(meta.created_at).toISOString(),
        md5Hash: meta.etag || undefined,
        publicUrl: buildPublicUrl(filePath, meta.resource_type),
      };
    } catch (_) {
      return null;
    }
  },

  async fileExists(filePath) {
    configureCloudinary();
    try {
      await cloudinary.api.resource(filePath, { resource_type: 'image' });
      return true;
    } catch (_) {}
    try {
      await cloudinary.api.resource(filePath, { resource_type: 'video' });
      return true;
    } catch (_) {}
    try {
      await cloudinary.api.resource(filePath, { resource_type: 'raw' });
      return true;
    } catch (_) {}
    return false;
  },

  async getFileSize(filePath) {
    const meta = await this.getFileMetadata(filePath);
    if (!meta) throw new Error('File not found');
    return parseInt(meta.size || 0);
  },

  async listFiles(directory, options = {}) {
    configureCloudinary();
    const prefix = directory.endsWith('/') ? directory : `${directory}/`;
    const res = await cloudinary.search.expression(`folder:${prefix}*`).max_results(options.maxResults || 100).execute();
    const files = (res.resources || []).map(r => ({
      name: r.public_id,
      size: r.bytes,
      contentType: r.resource_type,
      createdAt: r.created_at,
      updatedAt: r.created_at,
    }));
    return { files, nextPageToken: undefined };
  },
};



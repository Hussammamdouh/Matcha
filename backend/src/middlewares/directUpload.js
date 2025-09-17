const busboy = require('busboy');

/**
 * Middleware to accept multipart/form-data on create endpoints
 * - Streams any incoming files to Cloudinary (when STORAGE_PROVIDER=cloudinary)
 * - Populates req.body with text fields
 * - Populates req.body.media with [{ url, type }]
 *
 * Usage: place before validators on routes that should accept direct uploads
 */
module.exports = function directUpload(options = {}) {
  const { namespace = 'generic' } = options;
  return async function (req, res, next) {
    try {
      const contentType = req.headers['content-type'] || '';
      if (!contentType.startsWith('multipart/form-data')) {
        return next();
      }

      const isCloudinary = (process.env.STORAGE_PROVIDER || 'firebase').toLowerCase() === 'cloudinary';
      if (!isCloudinary) {
        return res.status(400).json({ ok: false, error: 'Direct multipart upload only supported for Cloudinary', code: 'DIRECT_UPLOAD_UNSUPPORTED' });
      }

      const cloudinary = require('cloudinary').v2;
      if (!cloudinary.config().cloud_name) {
        cloudinary.config({
          cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
          api_key: process.env.CLOUDINARY_API_KEY,
          api_secret: process.env.CLOUDINARY_API_SECRET,
          secure: true,
        });
      }

      const form = busboy({ headers: req.headers });
      const fields = {};
      const uploadedMedia = [];
      const uploadPromises = [];
      let fileCount = 0;
      let ended = false;

      function inferType(resourceType) {
        if (resourceType === 'image') return 'image';
        if (resourceType === 'video' || resourceType === 'raw') return 'audio';
        return 'image';
      }

      form.on('field', (name, value) => {
        // Support nested fields like media[0][type] if sent; otherwise basic fields
        fields[name] = value;
      });

      form.on('file', (name, file, info) => {
        fileCount += 1;
        const { filename } = info;
        const crypto = require('crypto');
        const randomId = crypto.randomBytes(6).toString('hex');
        const basePath = namespace === 'posts' ? 'uploads/posts' : namespace === 'comments' ? 'uploads/comments' : 'uploads/misc';
        const publicId = `${basePath}/${Date.now()}_${randomId}_${filename}`.replace(/\\/g, '/');
        const p = new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            { public_id: publicId, resource_type: 'auto', overwrite: true },
            (error, result) => {
              if (error) return reject(error);
              uploadedMedia.push({ url: result.secure_url, type: inferType(result.resource_type) });
              return resolve(result);
            }
          );
          file.pipe(uploadStream);
        });
        uploadPromises.push(p);
      });

      form.on('close', async () => {
        if (ended) return;
        try {
          // Wait for all uploads to finish
          await Promise.all(uploadPromises);
        } catch (e) {
          ended = true;
          return res.status(500).json({ ok: false, error: e.message || 'Upload failed', code: 'DIRECT_UPLOAD_FAILED' });
        }
        // Build req.body from collected fields
        req.body = req.body && typeof req.body === 'object' ? req.body : {};
        // Copy simple fields (title, body, visibility, communityId, etc.)
        for (const [k, v] of Object.entries(fields)) {
          if (!k.startsWith('media[')) {
            req.body[k] = v;
          }
        }
        // If client also provided media[] URLs via fields, include them
        const providedMedia = [];
        Object.keys(fields).forEach((k) => {
          // Expect patterns like media[0][url], media[0][type]
          const match = k.match(/^media\[(\d+)\]\[(url|type)\]$/);
          if (match) {
            const index = parseInt(match[1], 10);
            providedMedia[index] = providedMedia[index] || { url: null, type: 'image' };
            providedMedia[index][match[2]] = fields[k];
          }
        });

        const finalMedia = [];
        // Uploaded files first
        uploadedMedia.forEach((m) => finalMedia.push(m));
        // Any provided URLs next
        providedMedia.filter(Boolean).forEach((m) => {
          if (m && typeof m.url === 'string') finalMedia.push({ url: m.url, type: m.type || 'image' });
        });

        if (finalMedia.length > 0) {
          req.body.media = finalMedia;
        }

        return next();
      });

      req.pipe(form);
    } catch (error) {
      return res.status(500).json({ ok: false, error: 'Direct upload middleware error', code: 'DIRECT_UPLOAD_ERROR' });
    }
  };
}



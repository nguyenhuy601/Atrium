const firebaseStorage = require('./firebaseStorage');
const objectStorage = require('./objectStorage');

const ALLOWED_PREFIXES = ['temp/', 'tasks/', 'chat/', 'dm/'];

function normalizeStoragePath(storagePath) {
  return String(storagePath || '').trim().replace(/^\/+/, '');
}

function assertAllowedStoragePath(storagePath) {
  const normalizedPath = normalizeStoragePath(storagePath);
  if (!normalizedPath || normalizedPath.includes('..')) {
    const err = new Error('Invalid storagePath');
    err.statusCode = 400;
    throw err;
  }
  if (!ALLOWED_PREFIXES.some((prefix) => normalizedPath.startsWith(prefix))) {
    const err = new Error('storagePath not allowed');
    err.statusCode = 403;
    err.errorCode = 'MESSAGE_FORBIDDEN';
    throw err;
  }
  return normalizedPath;
}

function guessFileNameFromPath(storagePath) {
  const base = String(storagePath || '').split('/').pop() || 'file';
  const idx = base.indexOf('_');
  return idx >= 0 ? base.slice(idx + 1) || base : base;
}

function withUtf8ContentType(mimeType) {
  const mime = String(mimeType || '').trim().split(';')[0].trim();
  if (!mime) return 'application/octet-stream';
  if (mime.startsWith('text/') || mime === 'application/json') {
    return `${mime}; charset=utf-8`;
  }
  return mime;
}

function guessContentTypeFromFileName(fileName) {
  const n = String(fileName || '').toLowerCase();
  if (n.endsWith('.pdf')) return 'application/pdf';
  if (n.endsWith('.png')) return 'image/png';
  if (n.endsWith('.jpg') || n.endsWith('.jpeg')) return 'image/jpeg';
  if (n.endsWith('.gif')) return 'image/gif';
  if (n.endsWith('.webp')) return 'image/webp';
  if (n.endsWith('.svg')) return 'image/svg+xml';
  if (n.endsWith('.txt') || n.endsWith('.md') || n.endsWith('.markdown')) return 'text/plain';
  if (n.endsWith('.csv')) return 'text/csv';
  if (n.endsWith('.json')) return 'application/json';
  if (n.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (n.endsWith('.doc')) return 'application/msword';
  if (n.endsWith('.xlsx')) {
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }
  if (n.endsWith('.pptx')) {
    return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  }
  return 'application/octet-stream';
}

/**
 * @returns {Promise<{ stream: import('stream').Readable, backend: 'minio' | 'firebase', fileName: string }>}
 */
function resolveUploadStorageMode() {
  return String(process.env.CHAT_UPLOAD_STORAGE || 'auto').trim().toLowerCase();
}

async function openStorageObjectReadStream(storagePath) {
  const normalizedPath = assertAllowedStoragePath(storagePath);
  const fileName = guessFileNameFromPath(normalizedPath);
  const { isFirebaseBillingOrPermissionError } = require('./storageUpload');
  const uploadMode = resolveUploadStorageMode();
  const minioOnly = uploadMode === 'minio';
  const minioEnabled = objectStorage.isEnabled();

  // #region agent log
  try {
    fetch('http://host.docker.internal:7781/ingest/25418548-5637-4f11-a834-1c7c198bc9cb', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'bbb8bb' },
      body: JSON.stringify({
        sessionId: 'bbb8bb',
        runId: 'post-fix',
        hypothesisId: 'F',
        location: 'storageRead.js:openStorageObjectReadStream',
        message: 'open storage object',
        data: {
          path: normalizedPath.slice(0, 120),
          uploadMode,
          minioOnly,
          minioEnabled,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  } catch (_) {
    /* ignore */
  }
  // #endregion

  if (minioEnabled && (await objectStorage.objectExists(normalizedPath))) {
    return {
      stream: await objectStorage.getObjectStream(normalizedPath),
      backend: 'minio',
      fileName,
    };
  }

  // CHAT_UPLOAD_STORAGE=minio: không gọi Firebase (đã tắt) — thiếu object → 404.
  if (minioOnly || !firebaseStorage.isEnabled()) {
    const err = new Error('Object not found');
    err.statusCode = 404;
    err.errorCode = 'MESSAGE_NOT_FOUND';
    err.messageUser = 'Không tìm thấy tệp đính kèm trên MinIO.';
    throw err;
  }

  try {
    const bucket = firebaseStorage.getBucket();
    const file = bucket.file(normalizedPath);
    const [exists] = await file.exists();
    if (exists) {
      return {
        stream: file.createReadStream(),
        backend: 'firebase',
        fileName,
      };
    }
  } catch (err) {
    // #region agent log
    try {
      fetch('http://host.docker.internal:7781/ingest/25418548-5637-4f11-a834-1c7c198bc9cb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'bbb8bb' },
        body: JSON.stringify({
          sessionId: 'bbb8bb',
          runId: 'post-fix',
          hypothesisId: 'F',
          location: 'storageRead.js:firebaseCatch',
          message: 'Firebase read fallback failed',
          data: {
            path: normalizedPath.slice(0, 120),
            minioEnabled,
            isBillingOrAuth: isFirebaseBillingOrPermissionError(err),
            errMessage: String(err?.message || '').slice(0, 200),
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
    } catch (_) {
      /* ignore */
    }
    // #endregion
    if (isFirebaseBillingOrPermissionError(err)) {
      if (minioEnabled) {
        const e = new Error('Object not found');
        e.statusCode = 404;
        e.errorCode = 'MESSAGE_NOT_FOUND';
        e.messageUser = 'Không tìm thấy tệp đính kèm trên kho lưu trữ.';
        throw e;
      }
      const e = new Error('Kho lưu trữ Firebase tạm ngưng (billing/permission/auth).');
      e.statusCode = 503;
      e.errorCode = 'CHAT_STORAGE_UNAVAILABLE';
      e.messageUser =
        'Kho lưu trữ Firebase tạm ngưng. Dùng MinIO (CHAT_UPLOAD_STORAGE=minio).';
      throw e;
    }
    throw err;
  }

  const err = new Error('Object not found');
  err.statusCode = 404;
  err.errorCode = 'MESSAGE_NOT_FOUND';
  throw err;
}

module.exports = {
  ALLOWED_PREFIXES,
  normalizeStoragePath,
  assertAllowedStoragePath,
  guessFileNameFromPath,
  guessContentTypeFromFileName,
  withUtf8ContentType,
  openStorageObjectReadStream,
};

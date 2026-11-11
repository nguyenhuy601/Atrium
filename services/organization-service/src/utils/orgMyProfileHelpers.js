const crypto = require('crypto');

function parseIncludeSet(raw) {
  return new Set(
    String(raw || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

function weakEtagFromPayload(payload) {
  const hash = crypto.createHash('sha1').update(JSON.stringify(payload)).digest('hex');
  return `W/"${hash}"`;
}

function etagMatches(ifNoneMatch, etag) {
  const raw = String(ifNoneMatch || '').trim();
  if (!raw || !etag) return false;
  const wanted = String(etag).trim();
  return raw
    .split(',')
    .map((p) => p.trim())
    .some((part) => part === wanted || part === `W/${wanted}` || part === wanted.replace(/^W\//, ''));
}

module.exports = {
  parseIncludeSet,
  weakEtagFromPayload,
  etagMatches,
};

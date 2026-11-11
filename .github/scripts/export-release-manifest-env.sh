#!/usr/bin/env bash
# Export Swarm image env vars from release-manifest.json (promote-only).
# Usage:
#   eval "$(bash .github/scripts/export-release-manifest-env.sh ./release-manifest.json)"
#
# Maps:
#   client          → CLIENT_IMAGE
#   api-gateway     → API_GATEWAY_IMAGE
#   <name>-service  → <NAME>_SERVICE_IMAGE (e.g. auth-service → AUTH_SERVICE_IMAGE)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MANIFEST="${1:-release-manifest.json}"

if [[ ! -f "${MANIFEST}" ]]; then
  if [[ -f "${ROOT}/${MANIFEST}" ]]; then
    MANIFEST="${ROOT}/${MANIFEST}"
  else
    echo "Manifest not found: ${MANIFEST}" >&2
    exit 1
  fi
fi

export MANIFEST_PATH="${MANIFEST}"
node <<'NODE'
const fs = require('fs');

const manifestPath = process.env.MANIFEST_PATH;
const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const services = m.services || {};

function envNameForImage(image) {
  if (image === 'client') return 'CLIENT_IMAGE';
  if (image === 'api-gateway') return 'API_GATEWAY_IMAGE';
  return `${image.replace(/-/g, '_').toUpperCase()}_IMAGE`;
}

if (!services.client?.digest) {
  console.error('Missing services.client.digest — FE image not in manifest');
  process.exit(1);
}

const lines = [];
for (const [image, meta] of Object.entries(services).sort(([a], [b]) =>
  a.localeCompare(b)
)) {
  const digest = String(meta?.digest || '').trim();
  if (!digest.includes('@sha256:')) {
    console.error(`Invalid digest for ${image}: ${digest}`);
    process.exit(1);
  }
  const envName = envNameForImage(image);
  const safe = digest.replace(/'/g, "'\\''");
  lines.push(`export ${envName}='${safe}'`);
}

process.stdout.write(`${lines.join('\n')}\n`);
NODE

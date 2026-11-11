#!/usr/bin/env bash
# Resolve Swarm app Docker build matrix (PR verify + main publish).
# Bản tracked — devops/ không nằm trong git.
# Usage:
#   bash .github/scripts/resolve-docker-matrix.sh \
#     --event pr|push \
#     [--base <sha>] [--head <sha>] \
#     [--force-all] [--image <name>] \
#     [--bootstrap-missing <csv>] \
#     [--github-output]
#
# Prints matrix JSON to stdout; with --github-output also writes GITHUB_OUTPUT.
# RULE-03: --bootstrap-missing client,foo unions those catalog rows.
# RULE-04: shared/CI docker force rebuilds BE only (not client), then unions path hits.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

EVENT=""
BASE=""
HEAD="HEAD"
FORCE_ALL="false"
IMAGE=""
BOOTSTRAP_MISSING=""
GITHUB_OUTPUT_FLAG="false"

usage() {
  sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --event) EVENT="${2:-}"; shift 2 ;;
    --base) BASE="${2:-}"; shift 2 ;;
    --head) HEAD="${2:-}"; shift 2 ;;
    --force-all) FORCE_ALL="true"; shift ;;
    --image) IMAGE="${2:-}"; shift 2 ;;
    --bootstrap-missing) BOOTSTRAP_MISSING="${2:-}"; shift 2 ;;
    --github-output) GITHUB_OUTPUT_FLAG="true"; shift ;;
    -h|--help) usage 0 ;;
    *) echo "Unknown arg: $1" >&2; usage 1 ;;
  esac
done

[[ -n "${EVENT}" ]] || { echo "--event required (pr|push)" >&2; exit 1; }

IMAGES_FILE="${ROOT}/.github/swarm-app-images.json"
[[ -f "${IMAGES_FILE}" ]] || { echo "Missing ${IMAGES_FILE}" >&2; exit 1; }

# Collect changed paths (empty if force-all / no base)
CHANGED_FILE="$(mktemp)"
cleanup() { rm -f "${CHANGED_FILE}"; }
trap cleanup EXIT

FORCE_SHARED_DOCKER="false"
if [[ "${FORCE_ALL}" != "true" && -z "${IMAGE}" && -n "${BASE}" ]]; then
  if git -C "${ROOT}" rev-parse --verify "${BASE}" >/dev/null 2>&1; then
    git -C "${ROOT}" diff --name-only "${BASE}" "${HEAD}" > "${CHANGED_FILE}" || true
    # client/Dockerfile is path-selected as client — do not force all BE via this list.
    if git -C "${ROOT}" diff --name-only "${BASE}" "${HEAD}" -- \
      shared/ \
      .github/swarm-app-images.json \
      .github/workflows/ci.yml \
      .github/workflows/cd.yml \
      .github/scripts/resolve-docker-matrix.sh \
      .github/scripts/lib/selectDockerMatrix.cjs \
      'api-gateway/Dockerfile' \
      'services/*/Dockerfile' | grep -q .; then
      FORCE_SHARED_DOCKER="true"
    fi
  else
    echo "Base ${BASE} not found; building all" >&2
    FORCE_ALL="true"
  fi
elif [[ -z "${IMAGE}" && -z "${BASE}" && "${FORCE_ALL}" != "true" ]]; then
  echo "No --base; building all images" >&2
  FORCE_ALL="true"
fi

RESULT="$(
  FORCE_ALL="${FORCE_ALL}" \
  FORCE_SHARED_DOCKER="${FORCE_SHARED_DOCKER}" \
  IMAGE="${IMAGE}" \
  BOOTSTRAP_MISSING="${BOOTSTRAP_MISSING}" \
  IMAGES_FILE="${IMAGES_FILE}" \
  CHANGED_FILE="${CHANGED_FILE}" \
  EVENT="${EVENT}" \
  ROOT="${ROOT}" \
  node <<'NODE'
const fs = require('fs');
const path = require('path');
const { selectDockerMatrix } = require(path.join(
  process.env.ROOT,
  '.github/scripts/lib/selectDockerMatrix.cjs'
));

const catalog = JSON.parse(fs.readFileSync(process.env.IMAGES_FILE, 'utf8'));
const changed = fs.existsSync(process.env.CHANGED_FILE)
  ? fs.readFileSync(process.env.CHANGED_FILE, 'utf8').split(/\r?\n/).filter(Boolean)
  : [];
const bootstrapMissing = String(process.env.BOOTSTRAP_MISSING || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const { selected, label } = selectDockerMatrix({
  catalog,
  forceAll: process.env.FORCE_ALL === 'true',
  forceSharedDocker: process.env.FORCE_SHARED_DOCKER === 'true',
  onlyImage: process.env.IMAGE || '',
  changedPaths: changed,
  bootstrapMissing,
  event: process.env.EVENT,
});

console.error(label);

const hasImages = selected.length > 0;
const matrix = JSON.stringify({ include: selected });
process.stdout.write(`${matrix}\n${hasImages ? 'true' : 'false'}\n`);
NODE
)"

MATRIX="$(echo "${RESULT}" | head -n 1)"
HAS_IMAGES="$(echo "${RESULT}" | tail -n 1)"

echo "${MATRIX}"
if [[ "${GITHUB_OUTPUT_FLAG}" == "true" ]]; then
  {
    echo "matrix=${MATRIX}"
    echo "has_images=${HAS_IMAGES}"
  } >> "${GITHUB_OUTPUT:?GITHUB_OUTPUT not set}"
fi

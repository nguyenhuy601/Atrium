/**
 * One-shot: projects.methodology → scrum only.
 *
 * Usage (from services/project-service):
 *   DRY_RUN=1 node scripts/migrate-methodology-scrum-only.js
 *   node scripts/migrate-methodology-scrum-only.js
 *
 * Env: MONGODB_URI (via .env). Does not print the URI.
 * Uses mongoose + collection `projects` (no @enterprise/shared link required).
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');

const DRY_RUN = String(process.env.DRY_RUN || '').trim() === '1';
const DEFAULT_SPRINT_DAYS = 14;
const DEFAULT_SPRINT_START = 'monday';
const COLLECTION = 'projects';

function isNonScrumMethodology(value) {
  const m = String(value || '')
    .trim()
    .toLowerCase();
  return m !== 'scrum';
}

async function main() {
  const uri = String(process.env.MONGODB_URI || '').trim();
  if (!uri) {
    throw new Error('MONGODB_URI is not defined');
  }

  await mongoose.connect(uri);
  const col = mongoose.connection.collection(COLLECTION);

  const nonScrumFilter = {
    $or: [
      { methodology: { $exists: false } },
      { methodology: null },
      { methodology: { $nin: ['scrum'] } },
    ],
  };

  const nonScrumCount = await col.countDocuments(nonScrumFilter);
  const stagingDocs = await col
    .find(
      {
        'phase2ManualStaging.methodology': { $exists: true, $nin: [null, '', 'scrum'] },
      },
      { projection: { _id: 1, 'phase2ManualStaging.methodology': 1 } }
    )
    .toArray();
  const wipLeftCount = await col.countDocuments({
    'methodologySettings.wipLimit': { $exists: true, $ne: null },
  });

  console.log('[migrate-methodology-scrum-only] mode=%s', DRY_RUN ? 'DRY_RUN' : 'APPLY');
  console.log('[migrate-methodology-scrum-only] nonScrum projects: %d', nonScrumCount);
  console.log(
    '[migrate-methodology-scrum-only] phase2ManualStaging non-scrum: %d',
    stagingDocs.length
  );
  console.log('[migrate-methodology-scrum-only] docs with wipLimit set: %d', wipLeftCount);

  if (DRY_RUN) {
    console.log('[migrate-methodology-scrum-only] DRY_RUN — no writes');
    await mongoose.disconnect();
    return;
  }

  const projectResult = await col.updateMany(nonScrumFilter, {
    $set: {
      methodology: 'scrum',
      'methodologySettings.sprintDurationDays': DEFAULT_SPRINT_DAYS,
      'methodologySettings.sprintStartDay': DEFAULT_SPRINT_START,
    },
    $unset: { 'methodologySettings.wipLimit': '' },
  });

  let stagingModified = 0;
  for (const doc of stagingDocs) {
    if (!isNonScrumMethodology(doc?.phase2ManualStaging?.methodology)) continue;
    const updated = await col.updateOne(
      { _id: doc._id },
      { $set: { 'phase2ManualStaging.methodology': 'scrum' } }
    );
    stagingModified += updated.modifiedCount || 0;
  }

  const wipResult = await col.updateMany(
    { 'methodologySettings.wipLimit': { $exists: true, $ne: null } },
    { $unset: { 'methodologySettings.wipLimit': '' } }
  );

  const remainingNonScrum = await col.countDocuments(nonScrumFilter);
  const remainingStaging = await col.countDocuments({
    'phase2ManualStaging.methodology': { $exists: true, $nin: [null, '', 'scrum'] },
  });

  console.log(
    '[migrate-methodology-scrum-only] projects matched=%d modified=%d',
    projectResult.matchedCount,
    projectResult.modifiedCount
  );
  console.log('[migrate-methodology-scrum-only] staging methodology patched: %d', stagingModified);
  console.log(
    '[migrate-methodology-scrum-only] wipLimit unset matched=%d modified=%d',
    wipResult.matchedCount,
    wipResult.modifiedCount
  );
  console.log('[migrate-methodology-scrum-only] remaining nonScrum: %d', remainingNonScrum);
  console.log('[migrate-methodology-scrum-only] remaining staging non-scrum: %d', remainingStaging);

  if (remainingNonScrum !== 0 || remainingStaging !== 0) {
    throw new Error('Migrate incomplete — remaining non-scrum documents');
  }

  await mongoose.disconnect();
  console.log('[migrate-methodology-scrum-only] done');
}

main().catch(async (err) => {
  console.error('[migrate-methodology-scrum-only] failed:', err?.message || err);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});

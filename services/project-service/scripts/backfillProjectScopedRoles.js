/**
 * One-shot / ops: clone org ProjectRole defaults vào từng project + remap membership.
 * Idempotent — an toàn chạy lại.
 *
 * Usage (từ repo root, với MONGO URI project-service):
 *   node services/project-service/scripts/backfillProjectScopedRoles.js
 *   node services/project-service/scripts/backfillProjectScopedRoles.js --limit=50
 */
require('../src/db');
const Project = require('../src/models/Project');
const {
  cloneOrgRolesToProject,
  _clearProjectRolesCachesForTests,
} = require('../src/services/projectTeam.service');

async function main() {
  const limitArg = process.argv.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? Math.max(1, Number(limitArg.split('=')[1]) || 0) : 0;

  let query = Project.find({ isActive: { $ne: false } })
    .select('_id organizationId name')
    .sort({ createdAt: 1 });
  if (limit) query = query.limit(limit);

  const projects = await query.lean();
  console.log(`[backfillProjectScopedRoles] projects=${projects.length}`);

  try {
    const ProjectRole = require('../src/models/ProjectRole');
    await ProjectRole.syncIndexes();
    console.log('[backfillProjectScopedRoles] ProjectRole.syncIndexes ok');
  } catch (err) {
    console.warn('[backfillProjectScopedRoles] syncIndexes:', err.message);
  }

  let ok = 0;
  let fail = 0;
  for (const p of projects) {
    try {
      const roles = await cloneOrgRolesToProject(p._id, p.organizationId);
      ok += 1;
      console.log(`  ok ${p._id} roles=${roles.length}`);
    } catch (err) {
      fail += 1;
      console.error(`  fail ${p._id}: ${err.message}`);
    }
  }

  _clearProjectRolesCachesForTests();
  console.log(`[backfillProjectScopedRoles] done ok=${ok} fail=${fail}`);
  process.exit(fail ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

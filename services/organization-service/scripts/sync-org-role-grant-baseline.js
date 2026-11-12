#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Force-sync OrgRolePermission ticks + gộp ORG_OWNER/ORG_ADMIN → DIRECTOR.
 *
 *   node scripts/sync-org-role-grant-baseline.js
 *   node scripts/sync-org-role-grant-baseline.js --orgId=6a55d5f0888221ae1fca4fcf
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { connectDB, disconnectDB } = require('@enterprise/shared');
const Organization = require('../src/models/Organization');
const { ensureOrgRoleGrantBaseline } = require('../src/services/orgRoleGrantBaseline.service');

function argValue(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? String(hit.split('=').slice(1).join('=') || '').trim() : '';
}

async function run() {
  const onlyOrg = argValue('orgId');
  await connectDB();
  const filter = onlyOrg ? { _id: onlyOrg } : {};
  const orgs = await Organization.find(filter).select('_id name').lean();
  console.log(`[sync-baseline] orgs=${orgs.length}`);
  for (const org of orgs) {
    const id = String(org._id);
    const result = await ensureOrgRoleGrantBaseline(id, { force: true });
    console.log(`  ${org.name || id}:`, JSON.stringify(result));
  }
  await disconnectDB().catch(() => {});
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

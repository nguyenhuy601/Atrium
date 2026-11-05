#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Backfill department-scoped general + voice channels for existing organizations.
 *
 *   node services/organization-service/scripts/backfill-department-channels.js
 *   node services/organization-service/scripts/backfill-department-channels.js --orgId=<id>
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('@enterprise/shared');
const Department = require('../src/models/Department');
const { ensureDepartmentDefaultChannels } = require('../src/services/departmentChannelProvision.service');

function parseOrgIdArg() {
  const hit = process.argv.find((arg) => arg.startsWith('--orgId='));
  return hit ? String(hit.split('=')[1] || '').trim() : '';
}

async function run() {
  const filterOrgId = parseOrgIdArg();
  await connectDB();

  const deptQuery = filterOrgId ? { organization: filterOrgId } : {};
  const departments = await Department.find(deptQuery).sort({ organization: 1, createdAt: 1 }).lean();

  let createdCount = 0;
  let deptCount = 0;

  for (const department of departments) {
    deptCount += 1;
    const { created } = await ensureDepartmentDefaultChannels({
      orgId: department.organization,
      departmentId: department._id,
      department,
      actorId: department.head || null,
    });
    createdCount += created.length;
    if (created.length) {
      console.log(
        `org=${department.organization} dept=${department._id} (${department.name}): +${created.length} channels`
      );
    }
  }

  console.log(
    `backfill-department-channels: scanned ${deptCount} departments, created ${createdCount} channels`
  );
  await disconnectDB();
  await mongoose.connection.close().catch(() => null);
}

run().catch(async (err) => {
  console.error(err);
  await disconnectDB().catch(() => null);
  process.exit(1);
});

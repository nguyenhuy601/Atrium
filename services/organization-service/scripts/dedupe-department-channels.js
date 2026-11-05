#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Soft-delete duplicate department-scoped default channels (team: null).
 * Keeps the oldest active channel per (organization, department, type).
 *
 *   node services/organization-service/scripts/dedupe-department-channels.js
 *   node services/organization-service/scripts/dedupe-department-channels.js --orgId=<id>
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('@enterprise/shared');
const Channel = require('../src/models/Channel');
const { invalidateOrgReadCache } = require('../src/services/orgReadCache.service');

function parseOrgIdArg() {
  const hit = process.argv.find((arg) => arg.startsWith('--orgId='));
  return hit ? String(hit.split('=')[1] || '').trim() : '';
}

function groupKey(row) {
  return [
    String(row.organization),
    String(row.department),
    String(row.type || 'chat').toLowerCase(),
  ].join('|');
}

async function run() {
  const filterOrgId = parseOrgIdArg();
  await connectDB();

  const query = { team: null, department: { $ne: null }, isActive: true };
  if (filterOrgId) query.organization = filterOrgId;

  const rows = await Channel.find(query).sort({ createdAt: 1 }).lean();
  const groups = new Map();

  for (const row of rows) {
    const key = groupKey(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  let deactivated = 0;
  const touchedOrgs = new Set();

  for (const [, list] of groups) {
    if (list.length <= 1) continue;
    const [keep, ...dupes] = list;
    for (const dup of dupes) {
      await Channel.updateOne({ _id: dup._id }, { $set: { isActive: false } });
      deactivated += 1;
      touchedOrgs.add(String(keep.organization));
      console.log(
        `deactivate duplicate channel ${dup._id} (${dup.name}/${dup.type}) keep ${keep._id} dept=${dup.department}`
      );
    }
  }

  for (const orgId of touchedOrgs) {
    await invalidateOrgReadCache(orgId).catch(() => null);
  }

  console.log(
    `dedupe-department-channels: scanned ${rows.length} dept channels, deactivated ${deactivated} duplicates`
  );
  await disconnectDB();
  await mongoose.connection.close().catch(() => null);
}

run().catch(async (err) => {
  console.error(err);
  await disconnectDB().catch(() => null);
  process.exit(1);
});

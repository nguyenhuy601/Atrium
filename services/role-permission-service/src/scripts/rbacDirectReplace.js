#!/usr/bin/env node
/**
 * RBAC Direct Replace — purge legacy roles + seed templates/groups + rebind.
 *
 * Usage:
 *   node src/scripts/rbacV2DirectReplace.js --organizationId=<oid>
 *   node src/scripts/rbacV2DirectReplace.js --all   # every distinct organizationId in Role collection
 *
 * Requires Mongo connection via env (same as service).
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../../../.env') });
require('dotenv').config();

const { connectDB, disconnectDB, logger } = require('@enterprise/shared');
const { mongoose } = require('@enterprise/shared/config/mongo');
const Role = require('../models/Role');
const rbacService = require('../services/rbac.service');
const { assertCatalogIntegrity } = require('../config/rbacPermissions');

function parseArgs(argv) {
  const out = { organizationId: null, all: false };
  for (const arg of argv) {
    if (arg === '--all') out.all = true;
    else if (arg.startsWith('--organizationId=')) {
      out.organizationId = arg.slice('--organizationId='.length).trim();
    }
  }
  return out;
}

async function resolveOrganizationIds(opts) {
  if (opts.organizationId) return [opts.organizationId];
  if (!opts.all) {
    throw new Error('Pass --organizationId=<id> or --all');
  }
  const fromOrg = await Role.distinct('organizationId');
  const fromServer = await Role.distinct('serverId');
  const set = new Set(
    [...fromOrg, ...fromServer].map((x) => String(x || '').trim()).filter(Boolean)
  );
  return Array.from(set);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  assertCatalogIntegrity();
  await connectDB();
  await rbacService.seedSystemTemplates();

  const orgIds = await resolveOrganizationIds(opts);
  if (!orgIds.length) {
    logger.warn('[rbacV2DirectReplace] no organizations found');
    return;
  }

  const results = [];
  for (const organizationId of orgIds) {
    logger.info('[rbacV2DirectReplace] starting', { organizationId });
    const result = await rbacService.directReplaceOrganization({ organizationId });
    results.push({
      organizationId,
      groups: result.groups.length,
      roles: result.roles.length,
    });
  }

  logger.info('[rbacV2DirectReplace] done', { results });
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ success: true, results }, null, 2));
}

main()
  .catch((err) => {
    logger.error('[rbacV2DirectReplace] failed', err);
    // eslint-disable-next-line no-console
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await disconnectDB();
    } catch (_) {
      try {
        await mongoose.connection.close();
      } catch (__) {
        /* ignore */
      }
    }
  });

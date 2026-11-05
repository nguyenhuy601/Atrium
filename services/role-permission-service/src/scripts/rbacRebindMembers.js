#!/usr/bin/env node
/**
 * RBAC — rebind UserRole from Membership only (no purge).
 *
 * Use after direct-replace already ran and users lost chat:read / role assignments.
 *
 * Usage:
 *   node src/scripts/rbacV2RebindMembers.js --organizationId=<oid>
 *
 * Requires: Mongo + ORGANIZATION_SERVICE_URL + GATEWAY_INTERNAL_TOKEN
 * (org-service must expose GET /api/organizations/internal/memberships/:organizationId)
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../../../.env') });
require('dotenv').config();

const { connectDB, disconnectDB, logger } = require('@enterprise/shared');
const { mongoose } = require('@enterprise/shared/config/mongo');
const rbacService = require('../services/rbac.service');
const { assertCatalogIntegrity } = require('../config/rbacPermissions');

function parseArgs(argv) {
  const out = { organizationId: null };
  for (const arg of argv) {
    if (arg.startsWith('--organizationId=')) {
      out.organizationId = arg.slice('--organizationId='.length).trim();
    }
  }
  return out;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.organizationId) {
    throw new Error('Pass --organizationId=<id>');
  }
  assertCatalogIntegrity();
  await connectDB();

  // Refresh template grants on existing default groups is out of scope;
  // rematerialize role permissions for department_manager if group still old grants:
  await rbacService.seedSystemTemplates();

  const sync = await rbacService.syncDefaultGroupGrantsFromTemplates(opts.organizationId);
  const result = await rbacService.rebindOrganizationMembers({
    organizationId: opts.organizationId,
  });

  logger.info('[rbacV2RebindMembers] done', { sync, result });
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ success: true, sync, result }, null, 2));
}

main()
  .catch((err) => {
    logger.error('[rbacV2RebindMembers] failed', err);
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

/**
 * Mongo projection / aggregation for GET ?view=hitl.
 * Avoid loading import dumps + full FR row text into WiredTiger → Node.
 */

const mongoose = require('../../db');

/** Top-level arrays / dumps HITL Review does not need (Gate1 AC overlay uses slim FR). */
const PACK_HITL_EXCLUDE = [
  '-excelPreview',
  '-previewTree',
  '-importIssues',
  '-traceabilityLinks',
  '-requirementSkills',
  '-importSkillMeta',
  '-technology',
  '-integration',
  '-constraints',
  '-dependencies',
  '-assumptions',
  '-interfaces',
  '-dataEntities',
  '-glossary',
  '-actors',
  '-useCases',
  '-businessProcesses',
  '-businessRules',
  '-nonFunctionalRequirements',
  '-aiPlanning',
].join(' ');

/**
 * Aggregation: match + slim FR fields + drop heavy roots (inclusion project).
 * aiAnalysis still loaded then scrubbed/slimmed in service (Mixed nesting varies).
 */
function buildHitlPackAggregation({ packId, organizationId }) {
  const pidRaw = String(packId || '').trim();
  const oidRaw = String(organizationId || '').trim();
  if (!mongoose.isValidObjectId(pidRaw) || !mongoose.isValidObjectId(oidRaw)) {
    const err = new Error('packId/organizationId không hợp lệ');
    err.statusCode = 400;
    throw err;
  }
  const pid = new mongoose.Types.ObjectId(pidRaw);
  const oid = new mongoose.Types.ObjectId(oidRaw);
  return [
    {
      $match: {
        _id: pid,
        organizationId: oid,
        isActive: true,
      },
    },
    {
      $project: {
        organizationId: 1,
        status: 1,
        templateVersion: 1,
        versionNumber: 1,
        overview: 1,
        scope: 1,
        businessGoals: 1,
        staffingPlan: 1,
        aiAnalysis: 1,
        aiAnalysisStatus: 1,
        aiAnalysisActiveSnapshotId: 1,
        aiAnalysisSnapshotMeta: 1,
        projectId: 1,
        importSetId: 1,
        createdBy: 1,
        submittedBy: 1,
        submittedAt: 1,
        approvedBy: 1,
        approvedAt: 1,
        rejectedBy: 1,
        rejectedAt: 1,
        rejectionReason: 1,
        planningReadiness: 1,
        isActive: 1,
        createdAt: 1,
        updatedAt: 1,
        functionalRequirements: {
          $map: {
            input: { $ifNull: ['$functionalRequirements', []] },
            as: 'fr',
            in: {
              externalId: '$$fr.externalId',
              id: '$$fr.id',
              frId: '$$fr.frId',
              name: '$$fr.name',
              priority: '$$fr.priority',
              acceptanceCriteria: '$$fr.acceptanceCriteria',
              ac: '$$fr.ac',
              level: '$$fr.level',
              parentExternalId: '$$fr.parentExternalId',
            },
          },
        },
      },
    },
  ];
}

module.exports = {
  PACK_HITL_EXCLUDE,
  buildHitlPackAggregation,
};

const mongoose = require('../db');
const { PROPOSAL_STATUSES } = require('../services/executionControl/constants');

const executionProposalSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    issueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExecutionIssue',
      required: true,
      index: true,
    },
    proposalRevision: { type: Number, min: 1, default: 1 },
    status: { type: String, enum: PROPOSAL_STATUSES, default: 'draft', index: true },
    summary: { type: String, trim: true, default: '', maxlength: 2000 },
    /** Structured situation narrative + numbers from detection/impact tools. */
    situation: { type: mongoose.Schema.Types.Mixed, default: null },
    actions: { type: [mongoose.Schema.Types.Mixed], default: [] },
    /** Refs may be strings (legacy) or objects with id/type + numeric snapshots. */
    evidenceRefs: { type: [mongoose.Schema.Types.Mixed], default: [] },
    assumptions: { type: [mongoose.Schema.Types.Mixed], default: [] },
    preconditions: { type: [mongoose.Schema.Types.Mixed], default: [] },
    simulationRef: { type: mongoose.Schema.Types.Mixed, default: null },
    expectedVersions: { type: mongoose.Schema.Types.Mixed, default: {} },
    approvalRequirements: { type: [mongoose.Schema.Types.Mixed], default: [] },
    followUpCriteria: { type: [mongoose.Schema.Types.Mixed], default: [] },
    goalImpact: { type: mongoose.Schema.Types.Mixed, default: {} },
    interventionLevel: { type: String, default: 'propose' },
    appliedActionIds: { type: [String], default: [] },
    failedActionIds: { type: [String], default: [] },
    decision: {
      type: {
        decision: { type: String, enum: ['approved', 'rejected', null], default: null },
        decidedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
        decidedAt: { type: Date, default: null },
        note: { type: String, trim: true, default: '', maxlength: 2000 },
      },
      default: () => ({}),
    },
  },
  { timestamps: true }
);

executionProposalSchema.index({ issueId: 1, proposalRevision: -1 });

module.exports = mongoose.model('ExecutionProposal', executionProposalSchema);

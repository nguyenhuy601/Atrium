const mongoose = require('../db');
const { ISSUE_KINDS, ISSUE_STATUSES, INTERVENTION_LEVELS } = require('../services/executionControl/constants');

const executionIssueSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    kind: { type: String, enum: ISSUE_KINDS, required: true, index: true },
    status: { type: String, enum: ISSUE_STATUSES, default: 'open', index: true },
    title: { type: String, trim: true, required: true, maxlength: 240 },
    summary: { type: String, trim: true, default: '', maxlength: 4000 },
    subjectTaskIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }],
      default: [],
      index: true,
    },
    signals: { type: [String], default: [] },
    evidence: { type: [mongoose.Schema.Types.Mixed], default: [] },
    goalImpact: {
      type: {
        goalImpactStatus: {
          type: String,
          enum: ['UNKNOWN', 'PARTIAL', 'EVIDENCED', 'NONE'],
          default: 'UNKNOWN',
        },
        affectsSprintGoal: { type: Boolean, default: false },
        milestoneIds: { type: [String], default: [] },
        evidence: { type: mongoose.Schema.Types.Mixed, default: null },
      },
      default: () => ({ goalImpactStatus: 'UNKNOWN', affectsSprintGoal: false }),
    },
    interventionLevel: {
      type: String,
      enum: INTERVENTION_LEVELS,
      default: 'open_issue',
    },
    impactStatus: {
      type: String,
      enum: ['FULL', 'PARTIAL_IMPACT', 'UNSUPPORTED', 'UNKNOWN'],
      default: 'UNKNOWN',
    },
    rootIssueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExecutionIssue',
      default: null,
      index: true,
    },
    rootIncidentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProjectIncident',
      default: null,
      index: true,
    },
    activatedFromRiskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProjectRisk',
      default: null,
      index: true,
    },
    fingerprint: { type: String, trim: true, default: '', maxlength: 200, index: true },
    needsData: { type: Boolean, default: false },
    followUpAt: { type: Date, default: null },
    followUpFailCount: { type: Number, min: 0, default: 0 },
    followUpResults: { type: [mongoose.Schema.Types.Mixed], default: [] },
    graphRunId: { type: String, trim: true, default: '', maxlength: 120 },
    graphRunStatus: { type: String, trim: true, default: '', maxlength: 64 },
    latestProposalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExecutionProposal',
      default: null,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

executionIssueSchema.index({ projectId: 1, status: 1, updatedAt: -1 });
executionIssueSchema.index({ projectId: 1, fingerprint: 1, status: 1 });

module.exports = mongoose.model('ExecutionIssue', executionIssueSchema);

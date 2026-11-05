const mongoose = require('../db');

const projectRiskSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 240 },
    /** Cause → possible event → impact */
    description: { type: String, trim: true, default: '', maxlength: 4000 },
    status: {
      type: String,
      enum: ['identified', 'assessed', 'watching', 'occurred', 'closed', 'accepted'],
      default: 'identified',
      index: true,
    },
    assessment: {
      type: {
        likelihood: { type: String, trim: true, default: '', maxlength: 64 },
        impact: { type: String, trim: true, default: '', maxlength: 64 },
        uncertainty: { type: String, trim: true, default: '', maxlength: 120 },
        assessmentBasis: { type: String, trim: true, default: '', maxlength: 2000 },
        probabilityNumeric: { type: Number, min: 0, max: 1, default: null },
      },
      default: () => ({}),
    },
    scopeRefs: {
      type: {
        taskIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
        storyIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
        sprintIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
        milestoneIds: { type: [String], default: [] },
        budgetRef: { type: String, default: '' },
      },
      default: () => ({}),
    },
    ownerId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    triggers: {
      type: [
        {
          kind: { type: String, enum: ['warning', 'confirm'], default: 'warning' },
          conditionKey: { type: String, trim: true, maxlength: 120 },
          description: { type: String, trim: true, default: '', maxlength: 1000 },
          observed: { type: Boolean, default: false },
          observedAt: { type: Date, default: null },
        },
      ],
      default: [],
    },
    preventionActions: {
      type: [
        {
          text: { type: String, trim: true, maxlength: 1000 },
          status: {
            type: String,
            enum: ['pending', 'in_progress', 'done', 'cancelled'],
            default: 'pending',
          },
          dueAt: { type: Date, default: null },
        },
      ],
      default: [],
    },
    contingency: {
      type: {
        summary: { type: String, trim: true, default: '', maxlength: 2000 },
        actions: { type: [mongoose.Schema.Types.Mixed], default: [] },
        autoActionClasses: { type: [String], default: [] },
        approveActionClasses: { type: [String], default: [] },
      },
      default: () => ({}),
    },
    nextReviewAt: { type: Date, default: null, index: true },
    residual: {
      type: {
        status: { type: String, trim: true, default: '', maxlength: 64 },
        note: { type: String, trim: true, default: '', maxlength: 2000 },
        updatedAt: { type: Date, default: null },
      },
      default: () => ({}),
    },
    activatedIssueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExecutionIssue',
      default: null,
    },
    seedFromPlanningArtifactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PlanningArtifact',
      default: null,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  { timestamps: true }
);

projectRiskSchema.index({ projectId: 1, status: 1 });

module.exports = mongoose.model('ProjectRisk', projectRiskSchema);

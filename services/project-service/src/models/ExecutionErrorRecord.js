const mongoose = require('../db');
const { ERROR_CATEGORIES, RECOVERY_STATUSES } = require('../services/executionControl/constants');

const executionErrorRecordSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    issueId: { type: mongoose.Schema.Types.ObjectId, ref: 'ExecutionIssue', default: null, index: true },
    proposalId: { type: mongoose.Schema.Types.ObjectId, ref: 'ExecutionProposal', default: null },
    graphRunId: { type: String, trim: true, default: '', maxlength: 120, index: true },
    errorCode: { type: String, required: true, trim: true, maxlength: 64 },
    category: { type: String, enum: ERROR_CATEGORIES, required: true },
    retryable: { type: Boolean, default: false },
    failedStep: { type: String, trim: true, default: '', maxlength: 64 },
    affectedActionIds: { type: [String], default: [] },
    attemptCount: { type: Number, min: 0, default: 0 },
    nextRetryAt: { type: Date, default: null },
    recoveryStatus: { type: String, enum: RECOVERY_STATUSES, required: true, index: true },
    correlationId: { type: String, trim: true, default: '', maxlength: 120, index: true },
    detailSafe: { type: String, trim: true, default: '', maxlength: 2000 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ExecutionErrorRecord', executionErrorRecordSchema);

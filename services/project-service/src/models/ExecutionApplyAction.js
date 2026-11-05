const mongoose = require('../db');

/** Idempotent apply outcome store — key = proposalId:revision:actionId */
const executionApplyActionSchema = new mongoose.Schema(
  {
    lockKey: { type: String, required: true, unique: true, maxlength: 200 },
    organizationId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    proposalId: { type: mongoose.Schema.Types.ObjectId, ref: 'ExecutionProposal', required: true },
    proposalRevision: { type: Number, required: true },
    actionId: { type: String, required: true, maxlength: 80 },
    status: {
      type: String,
      enum: ['applied', 'not_applied', 'unknown'],
      default: 'unknown',
      index: true,
    },
    result: { type: mongoose.Schema.Types.Mixed, default: null },
    error: { type: String, trim: true, default: '', maxlength: 1000 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ExecutionApplyAction', executionApplyActionSchema);

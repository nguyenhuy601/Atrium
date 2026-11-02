const mongoose = require('../db');

const executionOutboxSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    eventId: { type: String, required: true, unique: true, maxlength: 120 },
    eventType: { type: String, required: true, trim: true, maxlength: 80, index: true },
    /** system_apply | forecast_recompute | board | scheduler | manual_incident | risk_trigger | resume */
    origin: { type: String, trim: true, default: 'board', maxlength: 64, index: true },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: ['pending', 'published', 'processed', 'failed', 'dead'],
      default: 'pending',
      index: true,
    },
    attempts: { type: Number, min: 0, default: 0 },
    lastError: { type: String, trim: true, default: '', maxlength: 1000 },
    processedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

executionOutboxSchema.index({ status: 1, createdAt: 1 });

module.exports = mongoose.model('ExecutionOutbox', executionOutboxSchema);

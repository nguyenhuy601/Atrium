const mongoose = require('../db');

const projectIncidentSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 240 },
    description: { type: String, trim: true, default: '', maxlength: 4000 },
    kind: {
      type: String,
      enum: ['staff_leave', 'vendor_delay', 'critical_defect', 'external', 'other'],
      default: 'other',
      index: true,
    },
    status: {
      type: String,
      enum: ['open', 'mitigating', 'resolved', 'cancelled'],
      default: 'open',
      index: true,
    },
    startedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    capacityImpact: { type: mongoose.Schema.Types.Mixed, default: {} },
    affectedUserIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId }],
      default: [],
    },
    affectedTaskIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }],
      default: [],
    },
    rootIssueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExecutionIssue',
      default: null,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ProjectIncident', projectIncidentSchema);

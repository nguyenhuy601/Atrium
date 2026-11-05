const crypto = require('crypto');
const ExecutionOutbox = require('../../models/ExecutionOutbox');
const { isExecutionControlEnabled } = require('./constants');

function newEventId(prefix = 'ece') {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(6).toString('hex')}`;
}

/**
 * Same-TX style enqueue (caller may wrap in session). Idempotent on eventId.
 */
async function enqueueOutboxEvent({
  organizationId,
  projectId,
  eventType,
  origin = 'board',
  payload = {},
  eventId = null,
}) {
  if (!isExecutionControlEnabled()) return null;
  const id = eventId || newEventId();
  try {
    const doc = await ExecutionOutbox.create({
      organizationId,
      projectId,
      eventId: id,
      eventType,
      origin,
      payload,
      status: 'pending',
    });
    return doc;
  } catch (err) {
    if (err && (err.code === 11000 || /duplicate/i.test(String(err.message)))) {
      return ExecutionOutbox.findOne({ eventId: id }).lean();
    }
    throw err;
  }
}

/**
 * Claim pending events for worker (at-least-once).
 * Atomically pending → published để nhiều replica không lấy trùng.
 */
async function claimPendingEvents({ limit = 20 } = {}) {
  const max = Math.max(1, Math.min(100, Math.floor(Number(limit) || 20)));
  const claimed = [];
  for (let i = 0; i < max; i += 1) {
    const doc = await ExecutionOutbox.findOneAndUpdate(
      { status: 'pending' },
      { $set: { status: 'published' }, $inc: { attempts: 1 } },
      { sort: { createdAt: 1 }, returnDocument: 'after' }
    ).lean();
    if (!doc) break;
    claimed.push(doc);
  }
  return claimed;
}

async function markOutboxProcessed(eventId, { failed = false, error = '' } = {}) {
  const update = failed
    ? {
        $set: { status: 'failed', lastError: String(error).slice(0, 1000) },
        $inc: { attempts: 1 },
      }
    : {
        $set: { status: 'processed', processedAt: new Date() },
        $inc: { attempts: 1 },
      };
  return ExecutionOutbox.findOneAndUpdate({ eventId }, update, {
    returnDocument: 'after',
  }).lean();
}

/** RULE-EC-08: system_apply / forecast_recompute should not re-propose unless new kind / follow-up fail */
function shouldStartAnalyzeFromOrigin(origin, { force = false } = {}) {
  if (force) return true;
  const o = String(origin || '');
  if (o === 'system_apply' || o === 'forecast_recompute') return false;
  return true;
}

module.exports = {
  newEventId,
  enqueueOutboxEvent,
  claimPendingEvents,
  markOutboxProcessed,
  shouldStartAnalyzeFromOrigin,
};

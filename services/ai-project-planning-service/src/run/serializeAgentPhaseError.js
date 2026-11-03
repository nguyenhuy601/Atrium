/**
 * Persist LangGraph AggregateError (and plain throws) without dropping nested causes.
 * AggregateError.message alone is useless — real causes live on error.errors[].
 */

const MAX_NESTED = 20;
const MAX_MSG = 500;

function slimThrown(err, index) {
  if (err == null) return { i: index, message: String(err) };
  return {
    i: index,
    name: err.name || null,
    code: err.code || null,
    message: String(err.message || err).slice(0, MAX_MSG),
  };
}

function serializeAgentPhaseError(error) {
  const nested = Array.isArray(error?.errors)
    ? error.errors.slice(0, MAX_NESTED).map((e, i) => slimThrown(e, i))
    : undefined;

  const out = {
    code:
      error?.code ||
      (nested?.length ? 'AGENT_PHASE_AGGREGATE' : 'AGENT_PHASE_FAILED'),
    message: String(error?.message || 'phase failed').slice(0, 1000),
  };
  if (nested?.length) out.errors = nested;
  if (error?.cause?.message) {
    out.cause = String(error.cause.message).slice(0, MAX_MSG);
  }
  return out;
}

module.exports = {
  serializeAgentPhaseError,
  slimThrown,
};

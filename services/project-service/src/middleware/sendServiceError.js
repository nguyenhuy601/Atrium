const { createServiceErrorHelper } = require('@enterprise/shared/middleware/httpErrorResponse');
const {
  classifyProjectError,
  toProductMessageUser,
} = require('../utils/projectErrorClassify');

const helper = createServiceErrorHelper('TASK_INTERNAL_ERROR');
const { sendServiceError: sendServiceErrorRaw } = helper;

/**
 * sendServiceError — luôn product-hóa messageUser/message trước khi trả client.
 * @param {import('express').Response} res
 * @param {number} status
 * @param {{ errorCode?: string, messageUser?: string, message?: string, extra?: object }} [opts]
 */
function sendServiceError(res, status, opts = {}) {
  const next = { ...(opts || {}) };
  if (next.messageUser != null) next.messageUser = toProductMessageUser(next.messageUser);
  if (next.message != null) next.message = toProductMessageUser(next.message);
  return sendServiceErrorRaw(res, status, next);
}

/**
 * Wrap shared sendErrorFromCatch with project-service classification
 * so system errors never leak as raw 4xx messages.
 */
function sendErrorFromCatch(res, err, fallbackStatus, fallbackMessage, fallbackCode) {
  const classified = classifyProjectError(err, fallbackStatus);
  if (classified.isInternal || classified.status >= 500) {
    // eslint-disable-next-line no-console
    console.error(
      JSON.stringify({
        errorCode: classified.errorCode,
        errName: classified.logName,
        status: classified.status,
      })
    );
  }

  const productFallback = fallbackMessage
    ? toProductMessageUser(fallbackMessage)
    : undefined;

  const safeErr = {
    statusCode: classified.status,
    errorCode: classified.errorCode || fallbackCode,
    messageUser: classified.messageUser,
    message: classified.isInternal || classified.status >= 500 ? undefined : classified.messageUser,
  };

  // Prefer classified message; for business errors keep fallbackMessage only if no message
  if (!classified.isInternal && classified.status < 500 && !safeErr.messageUser && productFallback) {
    safeErr.messageUser = productFallback;
    safeErr.message = productFallback;
  }

  return helper.sendErrorFromCatch(
    res,
    safeErr,
    classified.status,
    classified.messageUser || productFallback,
    classified.errorCode || fallbackCode
  );
}

module.exports = {
  sendServiceError,
  sendErrorFromCatch,
  INTERNAL_ERROR_CODE: 'TASK_INTERNAL_ERROR',
};

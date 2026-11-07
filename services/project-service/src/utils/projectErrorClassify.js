const { GENERIC_5XX_MESSAGE } = require('@enterprise/shared/middleware/httpErrorResponse');

const SAFE_ERROR_CODE_RE = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/;
const NETWORK_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ECONNABORTED',
]);

const MSG = Object.freeze({
  INVALID_ID: 'Mã định danh không hợp lệ.',
  VALIDATION: 'Dữ liệu không hợp lệ.',
  REQUIRED: 'Thiếu thông tin bắt buộc.',
  DUPLICATE: 'Dữ liệu đã tồn tại.',
  UPSTREAM: 'Dịch vụ liên quan tạm thời không khả dụng. Vui lòng thử lại sau.',
  BAD_JSON: 'Dữ liệu gửi lên không đúng định dạng JSON.',
  PAYLOAD_TOO_LARGE: 'Dữ liệu gửi lên quá lớn.',
  UPLOAD_TOO_LARGE: 'Tệp tải lên vượt quá dung lượng cho phép.',
  UPLOAD_INVALID: 'Tệp tải lên không hợp lệ.',
  CORS: 'Nguồn gốc yêu cầu không được phép.',
  WORKSPACE: 'Không thể xác thực workspace. Vui lòng thử lại sau.',
  FEATURE: 'Tính năng tạm thời không khả dụng.',
  FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này.',
  UNAUTHORIZED: 'Vui lòng đăng nhập lại.',
  NOT_FOUND: 'Không tìm thấy dữ liệu.',
  DB_BUSY: 'Hệ thống đang bận. Vui lòng thử lại sau.',
});

/**
 * Exact legacy messageUser / message → product copy (suite project + hub).
 * Keys are matched case-sensitive after trim.
 */
const EXACT_PRODUCT_MESSAGE_USER = Object.freeze({
  Forbidden: MSG.FORBIDDEN,
  Unauthorized: MSG.UNAUTHORIZED,
  'Not found': MSG.NOT_FOUND,
  'Database unavailable': MSG.DB_BUSY,
  'title là bắt buộc': 'Vui lòng nhập tên dự án.',
  'title and createdBy are required': MSG.REQUIRED,
  'organizationId không hợp lệ': 'Tổ chức không hợp lệ.',
  'organizationId bắt buộc': 'Cần chọn tổ chức.',
  'organizationId là bắt buộc': 'Cần chọn tổ chức.',
  'Thiếu organizationId.': 'Cần chọn tổ chức.',
  'Thiếu organizationId của dự án.': 'Cần chọn tổ chức.',
  'organizationId query parameter is required and must be a valid ObjectId': 'Cần chọn tổ chức.',
  'Invalid organizationId': 'Tổ chức không hợp lệ.',
  'organizationId does not match message organization': 'Tổ chức không khớp với tin nhắn.',
  'organizationId và packId bắt buộc': 'Cần tổ chức và gói yêu cầu.',
  'organizationId và sessionId bắt buộc': 'Cần tổ chức và phiên làm việc.',
  'organizationId và userId là bắt buộc': 'Cần tổ chức và người dùng.',
  'organizationId hoặc projectId là bắt buộc': 'Cần tổ chức hoặc dự án.',
  'organizationId/assigneePmId không hợp lệ': 'Tổ chức hoặc PM được gán không hợp lệ.',
  'projectId không hợp lệ': 'Dự án không hợp lệ.',
  'projectId không hợp lệ.': 'Dự án không hợp lệ.',
  'projectId/sprintId không hợp lệ': 'Dự án hoặc sprint không hợp lệ.',
  'projectId/crId không hợp lệ': 'Dự án hoặc yêu cầu thay đổi không hợp lệ.',
  'projectId/itemId không hợp lệ': 'Dự án hoặc mục công việc không hợp lệ.',
  'projectId/taskId không hợp lệ': 'Dự án hoặc task không hợp lệ.',
  'taskId không hợp lệ': 'Task không hợp lệ.',
  'cardId không hợp lệ': 'Thẻ công việc không hợp lệ.',
  'cardId/toListId không hợp lệ': 'Thẻ hoặc cột đích không hợp lệ.',
  'listId không hợp lệ': 'Cột board không hợp lệ.',
  'listId/boardId không hợp lệ': 'Cột hoặc board không hợp lệ.',
  'listId/toListId không hợp lệ': 'Cột nguồn hoặc cột đích không hợp lệ.',
  'listId/toBoardId không hợp lệ': 'Cột hoặc board đích không hợp lệ.',
  'boardId không hợp lệ': 'Board không hợp lệ.',
  'boardId/listId không hợp lệ': 'Board hoặc cột không hợp lệ.',
  'toListId không hợp lệ': 'Cột đích không hợp lệ.',
  'toBoardId không hợp lệ': 'Board đích không hợp lệ.',
  'roleId bắt buộc.': 'Cần chọn vai trò.',
  'briefId không hợp lệ': 'Brief không hợp lệ.',
  'featureId không hợp lệ': 'Feature không hợp lệ.',
  'teamId không hợp lệ': 'Nhóm không hợp lệ.',
  'scopeId không hợp lệ': 'Phạm vi không hợp lệ.',
  'targetSprintId không hợp lệ': 'Sprint đích không hợp lệ.',
  'incompleteAction không hợp lệ': 'Hành động xử lý việc dở dang không hợp lệ.',
  'orderedIds bắt buộc.': 'Cần danh sách thứ tự.',
  'fromRoleId/toRoleId (hoặc key) bắt buộc.': 'Cần vai trò nguồn và đích.',
  'entityType/entityId không hợp lệ.': 'Đối tượng liên kết không hợp lệ.',
  'userId là bắt buộc khi view=forecast': 'Cần chọn người dùng cho chế độ dự báo.',
  'dueFrom and dueTo are both required when filtering by due date': 'Cần đủ khoảng hạn hoàn thành.',
  'dueFrom and dueTo are both required for view=calendar': 'Cần đủ khoảng ngày cho lịch.',
  'dueFrom must be before or equal to dueTo': 'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.',
  'dueDate range cannot exceed 180 days': 'Khoảng hạn không được vượt quá 180 ngày.',
  'Invalid dueFrom or dueTo': 'Khoảng hạn không hợp lệ.',
  'content and userId are required': MSG.REQUIRED,
  'messageId and organizationId are required': MSG.REQUIRED,
  'Message has no file attachment': 'Tin nhắn không có tệp đính kèm.',
  'CHAT_INTERNAL_TOKEN is not configured': MSG.FEATURE,
  'file (.xlsx) bắt buộc': 'Vui lòng chọn tệp Excel (.xlsx).',
  'Label là bắt buộc.': 'Vui lòng nhập nhãn.',
  'label không hợp lệ.': 'Nhãn không hợp lệ.',
});

const FIELD_TOKEN_RE =
  /\b(organizationId|projectId|packId|sessionId|userId|sprintId|crId|itemId|taskId|cardId|listId|boardId|toListId|toBoardId|roleId|briefId|featureId|teamId|scopeId|targetSprintId|incompleteAction|orderedIds|assigneePmId|fromRoleId|toRoleId|entityType|entityId|dueFrom|dueTo|createdBy|messageId|serverId)\b/;

/**
 * Đổi messageUser/message dạng field/code/English tech → copy product (tiếng Việt).
 * Chuỗi đã product giữ nguyên.
 * @param {unknown} raw
 * @returns {string}
 */
function toProductMessageUser(raw) {
  const s = String(raw || '').trim();
  if (!s) return MSG.VALIDATION;

  if (EXACT_PRODUCT_MESSAGE_USER[s]) return EXACT_PRODUCT_MESSAGE_USER[s];

  if (/^[A-Z][A-Z0-9_]+$/.test(s)) return MSG.VALIDATION;

  if (/^Forbidden$/i.test(s)) return MSG.FORBIDDEN;
  if (/^Unauthorized$/i.test(s)) return MSG.UNAUTHORIZED;
  if (/^Not found$/i.test(s)) return MSG.NOT_FOUND;
  if (/^Database unavailable$/i.test(s)) return MSG.DB_BUSY;

  const hasApiFieldToken = FIELD_TOKEN_RE.test(s) || /\b[a-z][a-zA-Z0-9]*Id\b/.test(s);
  if (hasApiFieldToken) {
    if (/bắt buộc|required/i.test(s)) return MSG.REQUIRED;
    if (/không hợp lệ|invalid/i.test(s)) return MSG.INVALID_ID;
    return MSG.VALIDATION;
  }

  // English-only technical sentence → generic product (keep Vietnamese product copy)
  if (
    /^[A-Za-z0-9 .,_/()'":;+-]+$/.test(s) &&
    !/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(s)
  ) {
    if (/required|must be|cannot |invalid|forbidden|unauthorized|not found|unavailable/i.test(s)) {
      if (/forbidden/i.test(s)) return MSG.FORBIDDEN;
      if (/unauthorized/i.test(s)) return MSG.UNAUTHORIZED;
      if (/not found/i.test(s)) return MSG.NOT_FOUND;
      if (/unavailable|timeout|database/i.test(s)) return MSG.DB_BUSY;
      if (/required|must be/i.test(s)) return MSG.REQUIRED;
      return MSG.VALIDATION;
    }
  }

  return s;
}

/**
 * @param {unknown} code
 * @returns {string|undefined}
 */
function sanitizeErrorCode(code) {
  const raw = String(code || '').trim();
  if (!raw) return undefined;
  if (raw.startsWith('ERR_')) return undefined;
  if (NETWORK_CODES.has(raw)) return undefined;
  if (/^\d+$/.test(raw)) return undefined;
  if (raw === 'LIMIT_FILE_SIZE' || raw.startsWith('LIMIT_')) return undefined;
  if (!SAFE_ERROR_CODE_RE.test(raw)) return undefined;
  return raw;
}

function isAxiosLike(err) {
  return Boolean(err?.isAxiosError) || Boolean(err?.config && err?.response !== undefined && err?.request);
}

function isMongoDuplicate(err) {
  return err?.code === 11000 || err?.code === '11000' || /E11000/i.test(String(err?.message || ''));
}

function isCastOrBson(err) {
  const name = String(err?.name || '');
  return (
    name === 'CastError' ||
    name === 'BSONError' ||
    name === 'BSONTypeError' ||
    name === 'BSONObjectIdError'
  );
}

/**
 * Classify an error for client-safe response.
 * @param {unknown} err
 * @param {number} [fallbackStatus=400]
 * @returns {{ status: number, errorCode: string, messageUser: string, isInternal: boolean, logName: string }}
 */
function classifyProjectError(err, fallbackStatus = 400) {
  const e = err && typeof err === 'object' ? err : {};
  const name = String(e.name || (e instanceof Error ? e.constructor?.name : '') || 'Error');
  const code = e.code;
  const type = String(e.type || '');
  const fallback = Number(fallbackStatus) || 400;

  // Express body-parser / raw-body
  if (type === 'entity.too.large' || code === 'entity.too.large') {
    return {
      status: 413,
      errorCode: 'PROJECT_PAYLOAD_TOO_LARGE',
      messageUser: MSG.PAYLOAD_TOO_LARGE,
      isInternal: false,
      logName: name,
    };
  }
  if (type === 'entity.parse.failed' || (e instanceof SyntaxError && ('body' in e || type.includes('entity')))) {
    return {
      status: 400,
      errorCode: 'PROJECT_BAD_JSON',
      messageUser: MSG.BAD_JSON,
      isInternal: false,
      logName: name,
    };
  }

  if (name === 'MulterError') {
    if (code === 'LIMIT_FILE_SIZE') {
      return {
        status: 413,
        errorCode: 'PROJECT_UPLOAD_TOO_LARGE',
        messageUser: MSG.UPLOAD_TOO_LARGE,
        isInternal: false,
        logName: name,
      };
    }
    return {
      status: 400,
      errorCode: 'PROJECT_UPLOAD_INVALID',
      messageUser: MSG.UPLOAD_INVALID,
      isInternal: false,
      logName: name,
    };
  }

  if (String(e.message || '') === 'CORS blocked' || e.errorCode === 'CORS_FORBIDDEN') {
    return {
      status: 403,
      errorCode: 'CORS_FORBIDDEN',
      messageUser: MSG.CORS,
      isInternal: false,
      logName: name,
    };
  }

  if (isCastOrBson(e)) {
    return {
      status: 400,
      errorCode: 'VALIDATION_INVALID_ID',
      messageUser: MSG.INVALID_ID,
      isInternal: false,
      logName: name,
    };
  }

  if (name === 'ValidationError' && e.errors) {
    return {
      status: 400,
      errorCode: sanitizeErrorCode(e.errorCode) || 'VALIDATION_FAILED',
      messageUser: toProductMessageUser(e.messageUser || MSG.VALIDATION),
      isInternal: false,
      logName: name,
    };
  }

  if (isMongoDuplicate(e)) {
    return {
      status: 409,
      errorCode: 'DUPLICATE_RESOURCE',
      messageUser: MSG.DUPLICATE,
      isInternal: false,
      logName: name,
    };
  }

  if (isAxiosLike(e) || NETWORK_CODES.has(String(code || ''))) {
    return {
      status: 503,
      errorCode: 'UPSTREAM_UNAVAILABLE',
      messageUser: MSG.UPSTREAM,
      isInternal: true,
      logName: name,
    };
  }

  if (
    name === 'MongoNetworkError' ||
    name === 'MongoServerSelectionError' ||
    name === 'MongoTimeoutError' ||
    (name.startsWith('Mongo') && !isMongoDuplicate(e) && name !== 'MongoServerError')
  ) {
    return {
      status: 500,
      errorCode: 'TASK_INTERNAL_ERROR',
      messageUser: GENERIC_5XX_MESSAGE,
      isInternal: true,
      logName: name,
    };
  }

  if (name === 'MongoServerError') {
    return {
      status: 500,
      errorCode: 'TASK_INTERNAL_ERROR',
      messageUser: GENERIC_5XX_MESSAGE,
      isInternal: true,
      logName: name,
    };
  }

  if (name === 'TypeError' || name === 'ReferenceError' || name === 'RangeError') {
    return {
      status: 500,
      errorCode: 'TASK_INTERNAL_ERROR',
      messageUser: GENERIC_5XX_MESSAGE,
      isInternal: true,
      logName: name,
    };
  }

  // Business Error: keep status + message when present
  const statusFromErr = Number(e.statusCode);
  const hasBusinessStatus = Number.isFinite(statusFromErr) && statusFromErr >= 400 && statusFromErr < 600;
  const status = hasBusinessStatus ? statusFromErr : fallback;
  const isServer = status >= 500;
  const safeCode =
    sanitizeErrorCode(e.errorCode) ||
    sanitizeErrorCode(typeof code === 'string' ? code : '') ||
    (isServer ? 'TASK_INTERNAL_ERROR' : 'TASK_REQUEST_FAILED');

  if (isServer) {
    return {
      status,
      errorCode: safeCode,
      messageUser: GENERIC_5XX_MESSAGE,
      isInternal: true,
      logName: name,
    };
  }

  const messageUser = toProductMessageUser(e.messageUser || e.message || MSG.VALIDATION);
  return {
    status,
    errorCode: safeCode,
    messageUser,
    isInternal: false,
    logName: name,
  };
}

module.exports = {
  classifyProjectError,
  sanitizeErrorCode,
  toProductMessageUser,
  MSG,
};

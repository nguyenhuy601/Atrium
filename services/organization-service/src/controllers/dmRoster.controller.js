const dmRosterService = require('../services/dmRoster.service');
const { sendServiceError } = require('../middleware/sendServiceError');
const { logger } = require('@enterprise/shared');

function actorId(req) {
  return String(req.user?.id || req.user?.userId || req.user?._id || '').trim();
}

async function getFriends(req, res) {
  try {
    const userId = actorId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
    const data = await dmRosterService.listFriends(userId, { page, limit });
    return res.json({ success: true, data });
  } catch (error) {
    logger.error('[dmRoster] getFriends error:', error);
    // #region agent log
    try {
      const msg = String(error?.message || error || '').slice(0, 300);
      const stack = String(error?.stack || '').split('\n').slice(0, 4).join(' | ').slice(0, 500);
      fetch('http://host.docker.internal:7781/ingest/25418548-5637-4f11-a834-1c7c198bc9cb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'bbb8bb' },
        body: JSON.stringify({
          sessionId: 'bbb8bb',
          runId: 'pre-fix',
          hypothesisId: 'A',
          location: 'dmRoster.controller.js:getFriends',
          message: 'dmRoster getFriends 500',
          data: { errMessage: msg, stack, userId: String(actorId(req) || '').slice(0, 24) },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
    } catch (_) {
      /* ignore */
    }
    // #endregion
    return sendServiceError(res, 500, {
      errorCode: 'DM_ROSTER_LIST_FAILED',
      messageUser: 'Không tải được danh sách liên lạc.',
    });
  }
}

async function getRelationship(req, res) {
  try {
    const userId = actorId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const peerId = String(req.params.friendId || req.params.peerId || '').trim();
    if (!peerId) {
      return res.status(400).json({
        success: false,
        message: 'friendId is required',
        errorCode: 'DM_ROSTER_PEER_REQUIRED',
      });
    }
    const data = await dmRosterService.getRelationship(userId, peerId);
    return res.json({ success: true, data });
  } catch (error) {
    logger.error('[dmRoster] getRelationship error:', error);
    return sendServiceError(res, 500, {
      errorCode: 'DM_ROSTER_RELATIONSHIP_FAILED',
      messageUser: 'Không kiểm tra được quan hệ DM.',
    });
  }
}

function goneGraph(req, res) {
  return res.status(410).json({
    success: false,
    message: 'Friend graph endpoints are removed. Use derived roster ACL.',
    errorCode: 'FRIEND_GRAPH_GONE',
  });
}

module.exports = {
  getFriends,
  getRelationship,
  goneGraph,
};

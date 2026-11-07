const Project = require('../models/Project');
const ProjectMember = require('../models/ProjectMember');
const { sendServiceError, sendErrorFromCatch } = require('../middleware/sendServiceError');

/**
 * S2S — project IDs active của user trong org (org-service chat ACL fallback).
 * GET /api/projects/internal/org/:organizationId/users/:userId/project-ids
 */
async function listUserProjectIdsInOrg(req, res) {
  try {
    const organizationId = String(req.params.organizationId || '').trim();
    const userId = String(req.params.userId || '').trim();
    if (!organizationId || !userId) {
      return sendServiceError(res, 400, {
        errorCode: 'VALIDATION_INVALID_ID',
        messageUser: 'organizationId và userId bắt buộc.',
        message: 'organizationId and userId required',
      });
    }

    const projects = await Project.find({
      organizationId,
      isActive: { $ne: false },
    })
      .select('_id')
      .lean();
    const projectIds = projects.map((p) => String(p._id)).filter(Boolean);
    if (!projectIds.length) {
      return res.json({ success: true, data: { projectIds: [] } });
    }

    const rows = await ProjectMember.find({
      userId,
      status: 'active',
      projectId: { $in: projectIds },
    })
      .select('projectId')
      .lean();

    const out = [
      ...new Set(rows.map((r) => String(r.projectId || '').trim()).filter(Boolean)),
    ];
    return res.json({ success: true, data: { projectIds: out } });
  } catch (error) {
    return sendErrorFromCatch(
      res,
      error,
      500,
      'Không thể tải danh sách dự án của thành viên.',
      'PROJECT_MEMBERSHIP_INTERNAL_FAILED'
    );
  }
}

module.exports = {
  listUserProjectIdsInOrg,
};

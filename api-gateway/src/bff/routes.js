const express = require('express');
const { handleBootstrap } = require('./bootstrap.handler');
const { handleProjectOverview } = require('./projectOverview.handler');

/** BFF không cần permission middleware (bootstrap). */
const publicBffRouter = express.Router();

/**
 * @openapi
 * /api/bootstrap:
 *   get:
 *     tags: [BFF]
 *     summary: Bootstrap session / app shell data
 *     description: Aggregate dữ liệu khởi động client qua Gateway BFF. Yêu cầu JWT.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Bootstrap payload
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccess'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
publicBffRouter.get('/api/bootstrap', handleBootstrap);

publicBffRouter.get('/api/projects/:projectId/overview', handleProjectOverview);

/**
 * Org read models đi REST proxy (org-service) — không còn BFF wrap documents-overview.
 * Giữ router rỗng để index.js không đổi import.
 */
const orgBffRouter = express.Router();

module.exports = { publicBffRouter, orgBffRouter };

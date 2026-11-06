/**
 * Curated paths — BFF + dashboard report resource.
 */

const { buildOperation, pathParam } = require('../components/op.helpers');

module.exports = {
  '/api/bootstrap': {
    get: buildOperation({
      operationId: 'getBootstrap',
      tags: ['BFF'],
      summary: 'Bootstrap session / app shell',
      description: 'Aggregate dữ liệu khởi động client qua Gateway BFF.',
      requireNotFound: false,
      successExample: { success: true, data: { user: {}, organizations: [] } },
    }),
  },
  '/api/reports/v1/dashboard/me': {
    get: buildOperation({
      operationId: 'getDashboardMe',
      tags: ['Reports'],
      summary: 'Dashboard summary (read model)',
      description:
        'Tóm tắt dashboard cá nhân từ report-service CQRS read model. Warm Redis; miss/stale thì snapshot refresh.',
      requireNotFound: false,
      successExample: {
        success: true,
        data: { orgCount: 0, asOf: '2026-01-01T00:00:00.000Z', upcomingMeetings: [] },
      },
    }),
  },
  '/api/organizations/{orgId}/documents-overview': {
    get: buildOperation({
      operationId: 'getOrgDocumentsOverview',
      tags: ['Organizations'],
      summary: 'Documents overview (REST)',
      description:
        'Tổng quan tài liệu theo org — proxy organization-service. Query view=summary|full.',
      parameters: [pathParam('orgId', 'Organization id')],
      successExample: {
        success: true,
        data: { documentCount: 0, channels: [], attachmentMessages: [], libraryDocuments: [] },
      },
    }),
  },
};

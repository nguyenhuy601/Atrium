# report-service

Xem [ADR-003](../../docs/architecture/ADR-003-report-olap.md) và [ADR-005](../../docs/architecture/ADR-005-dashboard-read-model.md).

Port mặc định: **3026** (`REPORT_SERVICE_URL=http://report-service:3026`).

## Dashboard Read Model

- `GET /api/reports/v1/dashboard/me` — gateway trust + `x-user-id` (browser SoT)
- `GET /internal/reports/v1/dashboard/:userId` — internal token
- Miss/stale (`DASHBOARD_RM_MAX_AGE_SEC`, default 45): sync `refreshDashboardSnapshot` + coalesce
- Consumer optional: `ENABLE_DASHBOARD_PROJECTION_CONSUMER=true` + `RABBITMQ_URL`
- Store: Redis `dash:rm:user:{userId}` (hoặc memory nếu `DASHBOARD_RM_MEMORY=true`)

Gateway: `REPORT_SERVICE_URL` + `REPORT_AGGREGATOR_MODE=c2_api` để mount `/api/reports`.

Không share DB OLTP với project/task.

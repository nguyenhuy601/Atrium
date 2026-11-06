import api from './api';
import { unwrapApiData } from '../utils/helpers';

/** GET /api/reports/v1/dashboard/me — report-service dashboard read model. */
export async function fetchDashboardSummary() {
  const res = await api.get('/reports/v1/dashboard/me', { skipGlobalErrorHandling: true });
  const data = unwrapApiData(res) ?? res;
  if (data && typeof data === 'object') {
    const rm = res?.headers?.['x-dashboard-rm'] || res?.headers?.['X-Dashboard-Rm'];
    if (rm) data._rm = String(rm).toUpperCase();
  }
  return data;
}

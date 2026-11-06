import { useQuery } from '@tanstack/react-query';
import projectAPI from '../../../../services/api/projectAPI';
import { queryKeys } from '../../../../lib/queryKeys';

export async function fetchClosureReport(projectId) {
  const res = await projectAPI.getClosureReport(projectId);
  return res?.data?.data ?? res?.data ?? res;
}

export default function useClosureReportQuery(projectId) {
  const pid = String(projectId || '').trim();
  return useQuery({
    queryKey: queryKeys.projectHub.closureReport(pid),
    queryFn: () => fetchClosureReport(pid),
    enabled: Boolean(pid),
    staleTime: 60_000,
  });
}

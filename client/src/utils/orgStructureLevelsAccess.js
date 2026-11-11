/** Phân loại lỗi GET structure/levels — không phụ thuộc React Query. */

function httpStatusOf(error) {
  const status = Number(
    error?.response?.status || error?.status || error?.statusCode || 0
  );
  return Number.isFinite(status) && status > 0 ? status : 0;
}

/** 403 = thiếu organization.structure.view — không suy ra «chưa setup». */
export function isOrgStructureLevelsForbidden(error) {
  return httpStatusOf(error) === 403;
}

import { Navigate } from 'react-router-dom';
import useCompanyAdminAccess from '../../hooks/useCompanyAdminAccess';
import { getDefaultPathForSuite, readStoredSuite, SUITE, writeStoredSuite } from '../../utils/suitePathUtils';

/**
 * Suite entry redirect → suite mặc định.
 * System admin luôn vào shell Admin (không vào Communicate/Company/Projects/Manage).
 * User grant → Suite Quản trị `/manage` nếu đã lưu ADMIN/MANAGE.
 */
const SuiteRootRedirect = () => {
  const { isSystemAdmin, canAccessHub } = useCompanyAdminAccess();
  const storedSuite = readStoredSuite();

  if (isSystemAdmin) {
    if (storedSuite !== SUITE.ADMIN) writeStoredSuite(SUITE.ADMIN);
    return <Navigate to={getDefaultPathForSuite(SUITE.ADMIN)} replace />;
  }

  let targetSuite = storedSuite;
  if (targetSuite === SUITE.ADMIN || targetSuite === SUITE.MANAGE) {
    targetSuite = canAccessHub ? SUITE.MANAGE : SUITE.COMPANY;
  }
  if (targetSuite !== storedSuite) writeStoredSuite(targetSuite);

  return <Navigate to={getDefaultPathForSuite(targetSuite)} replace />;
};

export default SuiteRootRedirect;

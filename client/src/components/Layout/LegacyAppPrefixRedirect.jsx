import { Navigate, useLocation } from 'react-router-dom';
import SuiteRootRedirect from './SuiteRootRedirect';
import { stripLegacyAppPrefix } from '../../utils/suitePathUtils';

/**
 * Legacy `/app` and `/app/*` → canonical suite paths (strip prefix; bare `/app` → suite home).
 * Keeps search + hash. Pathname-only strip (no open-redirect).
 */
export default function LegacyAppPrefixRedirect() {
  const location = useLocation();
  const path = String(location.pathname || '').replace(/\/+/g, '/') || '/';

  if (path === '/app' || path === '/app/') {
    return <SuiteRootRedirect />;
  }

  if (!path.startsWith('/app/')) {
    return <SuiteRootRedirect />;
  }

  const stripped = stripLegacyAppPrefix(path);
  const targetPath = stripped === '/' ? '/' : stripped;
  return (
    <Navigate
      to={{ pathname: targetPath, search: location.search, hash: location.hash }}
      replace
    />
  );
}

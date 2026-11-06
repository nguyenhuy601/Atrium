import { Navigate, useLocation } from 'react-router-dom';
import { mapCollaboratePathToDualSuite } from '../../utils/suitePathUtils';

/** Redirect legacy /collaborate/* (và sau strip /app) → /company/* hoặc /projects/*. */
export default function CollaborateLegacyRedirect() {
  const location = useLocation();
  const to = mapCollaboratePathToDualSuite(location.pathname, location.search);
  return <Navigate to={to} replace />;
}

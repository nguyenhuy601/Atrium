import { PROJECT_COLLAB_OPS_MODULES } from '../../../utils/projectPhaseNav';
import {
  isProjectAccessDeniedError,
  shouldDenyProjectEntry,
} from '../projectRoleEntry';
import {
  canEnterProjectSettings,
  normalizeProjectCapabilities,
} from '../projectCapabilities';

export {
  isProjectAccessDeniedError,
  shouldDenyProjectEntry,
  canEnterProjectSettings,
  normalizeProjectCapabilities,
};

/** AI HITL incomplete — still allow collab/ops (+ ai-hitl host). */
export function isAiHitlCollabOpsModule(module) {
  const mod = String(module || '')
    .trim()
    .toLowerCase();
  return mod === 'ai-hitl' || PROJECT_COLLAB_OPS_MODULES.includes(mod);
}

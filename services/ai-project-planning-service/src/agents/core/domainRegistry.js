/**
 * Tool whitelist per domain. Master has none.
 * Agents cannot declare tools outside this list at runtime.
 */

const MASTER_TOOLS = Object.freeze([]);

const BUSINESS_TOOL_NAMES = Object.freeze([
  'WbsTool',
  'DependencyTool',
  'RiskTool',
  'RiskToolSource',
  'RiskToolDependency',
  'QualityPlanTool',
  'ScheduleTool',
  'ProjectPlanTool',
  'WhatFrTool',
  'approveRelease',
  'setDelivered',
  'stampGate',
]);

const HOW_AGENTS = Object.freeze({
  DependencyTool: Object.freeze([
    'retrieveTaskContext',
    'retrieveArchitectureEvidence',
    'proposeDependencies',
    'validateDependency',
  ]),
  RiskToolSource: Object.freeze(['retrieveRiskTriggers', 'proposeRisk']),
  RiskToolDependency: Object.freeze(['retrieveDependencyEdges', 'proposeRisk']),
  QualityPlanTool: Object.freeze(['proposeQuality']),
  ArchitectureTool: Object.freeze(['proposeArchitecture']),
  WbsTool: Object.freeze(['decomposeWbs']),
  ScheduleTool: Object.freeze(['buildSchedule']),
});

const WHAT_AGENTS = Object.freeze({
  WhatBGTool: Object.freeze(['deriveSection']),
  WhatBRTool: Object.freeze(['deriveSection']),
  WhatNFRTool: Object.freeze(['deriveSection']),
  WhatScopeTool: Object.freeze(['deriveSection']),
  WhatBPMTool: Object.freeze(['deriveSection']),
  WhatActorsTool: Object.freeze(['deriveSection']),
  WhatFrTool: Object.freeze(['deriveSection']),
  WhatUCTool: Object.freeze(['deriveSection']),
  WhatDataTool: Object.freeze(['deriveSection']),
});

const DELIVERY_AGENTS = Object.freeze({
  releaseReadiness: Object.freeze(['assessReleaseCriteria']),
  qualityGate: Object.freeze(['checkQualityConditions']),
});

const DELIVERY_FORBIDDEN = Object.freeze([
  'approveRelease',
  'setDelivered',
  'stampRelease',
  'approveHandover',
]);

function toolsFor(domain, agentId) {
  const table =
    domain === 'how' ? HOW_AGENTS : domain === 'what' ? WHAT_AGENTS : domain === 'delivery' ? DELIVERY_AGENTS : null;
  if (!table) return [];
  return table[agentId] ? [...table[agentId]] : [];
}

function masterTools() {
  return [...MASTER_TOOLS];
}

function isToolAllowed(domain, agentId, toolName) {
  return toolsFor(domain, agentId).includes(String(toolName || ''));
}

function assertDeliveryHasNoApprovalTools() {
  const names = Object.keys(DELIVERY_AGENTS);
  for (const name of names) {
    const lower = name.toLowerCase();
    if (lower.includes('approve') || lower.includes('setdelivered')) {
      throw new Error(`Delivery registry chứa tool duyệt: ${name}`);
    }
    for (const tool of DELIVERY_AGENTS[name]) {
      if (DELIVERY_FORBIDDEN.includes(tool)) {
        throw new Error(`Delivery tool bị cấm: ${tool}`);
      }
    }
  }
}

module.exports = {
  MASTER_TOOLS,
  BUSINESS_TOOL_NAMES,
  HOW_AGENTS,
  WHAT_AGENTS,
  DELIVERY_AGENTS,
  DELIVERY_FORBIDDEN,
  toolsFor,
  masterTools,
  isToolAllowed,
  assertDeliveryHasNoApprovalTools,
};

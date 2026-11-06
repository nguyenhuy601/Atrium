export const BACKEND_CAPABILITIES = Object.freeze({
  aiChannelCatchupSummary: true,
  documentBinaryUpload: false,
  documentStarred: false,
  voiceTranscriptMinutes: true,
  calendarEventService: false,
  documentShareAcl: false,
  documentCopyMove: false,
  apiKeys: false,
  billingInvoices: false,
  integrations: false,
  auditLogs: false,
});

export function hasBackendCapability(key) {
  return Boolean(BACKEND_CAPABILITIES[key]);
}

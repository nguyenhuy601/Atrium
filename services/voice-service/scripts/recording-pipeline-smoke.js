#!/usr/bin/env node
/**
 * Smoke: voice recording → MinIO → MongoDB → STT transcript → AI summary
 *
 * Chạy trong container voice-service (có mongoose + rabbit + minio):
 *   node scripts/recording-pipeline-smoke.js
 *
 * Tiền đề: file webm đã upload lên MinIO (temp path) — script bash tạo trước.
 */
/* eslint-disable no-console */
const { randomUUID } = require('crypto');
const { connectDB, disconnectDB } = require('@enterprise/shared');
const Meeting = require('../src/models/Meeting');
const MeetingRecordingSegment = require('../src/models/MeetingRecordingSegment');
const meetingRecordingSegmentService = require('../src/services/meetingRecordingSegment.service');
const meetingAiSummaryService = require('../src/services/meetingAiSummary.service');
const objectStorage = require('../src/utils/objectStorage');
const { publishJson } = require('../src/messaging/rabbit');
const { VOICE_RECORDING_PROCESS_QUEUE } = require('@enterprise/shared/messaging/voiceRecordingEvents');
const { VOICE_STT_QUEUE } = require('@enterprise/shared/messaging/voiceSttEvents');

const TEMP_WEBM_PATH = process.env.SMOKE_TEMP_WEBM_PATH || '';
const POLL_MS = 3000;
const RECORDING_TIMEOUT_MS = Number(process.env.SMOKE_RECORDING_TIMEOUT_MS || 180000);
const SUMMARY_TIMEOUT_MS = Number(process.env.SMOKE_SUMMARY_TIMEOUT_MS || 180000);

const SMOKE_TRANSCRIPT =
  process.env.SMOKE_TRANSCRIPT ||
  'Xin chào mọi người. Hôm nay chúng ta thảo luận về kế hoạch triển khai Atrium. ' +
    'Anh Nam sẽ phụ trách phần ghi âm server-side. Chị Lan hoàn thành báo cáo vào thứ Sáu.';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitFor(predicate, label, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = await predicate();
    if (value) return value;
    process.stdout.write(`  … chờ ${label} (${Math.round((Date.now() - start) / 1000)}s)\n`);
    await sleep(POLL_MS);
  }
  throw new Error(`Timeout: ${label}`);
}

async function main() {
  if (!TEMP_WEBM_PATH) {
    throw new Error('Set SMOKE_TEMP_WEBM_PATH (webm trên MinIO)');
  }

  console.log('[smoke] Kết nối MongoDB…');
  await connectDB(null, { exitOnFailure: true });

  const hostId = '507f1f77bcf86cd799439011';
  const roomKey = `smoke-${Date.now()}`;
  const now = new Date();
  const startTime = new Date(now.getTime() - 120_000);

  const meeting = await Meeting.create({
    title: `Smoke recording ${new Date().toISOString()}`,
    hostId,
    lobbyRoomId: roomKey,
    status: 'ended',
    startTime,
    endTime: now,
    durationSec: 120,
    participants: [{ userId: hostId, joinedAt: startTime, leftAt: now }],
    recordingStatus: 'none',
    aiSummaryEnabled: true,
    transcriptSource: 'realtime',
  });
  const meetingId = String(meeting._id);
  console.log(`[smoke] Meeting tạo: ${meetingId}`);

  const minioOk = await objectStorage.objectExists(TEMP_WEBM_PATH);
  if (!minioOk) {
    throw new Error(`MinIO thiếu object: ${TEMP_WEBM_PATH}`);
  }
  console.log(`[smoke] MinIO OK: ${TEMP_WEBM_PATH}`);

  // --- 1) Recording pipeline (legacy webm → opus) ---
  await Meeting.findByIdAndUpdate(meetingId, {
    $set: { recordingStatus: 'processing', tempStoragePath: TEMP_WEBM_PATH, isRecording: false },
  });
  await publishJson(VOICE_RECORDING_PROCESS_QUEUE, {
    jobType: 'legacy_full',
    meetingId,
    roomKey,
    tempStoragePath: TEMP_WEBM_PATH,
    durationSec: 3,
    opusBitrateKbps: 16,
    skipTranscript: false,
  });
  console.log('[smoke] Đã publish voice.recording.process');

  const meetingAfterRec = await waitFor(
    async () => {
      const m = await Meeting.findById(meetingId).lean();
      if (m?.recordingStatus === 'ready' && m.audioStoragePath) return m;
      if (m?.recordingStatus === 'failed') throw new Error(`Recording failed: ${m?.error || 'unknown'}`);
      return null;
    },
    'recording ready + audioStoragePath',
    RECORDING_TIMEOUT_MS
  );
  console.log(`[smoke] Recording ready: ${meetingAfterRec.audioStoragePath}`);

  const audioInMinio = await objectStorage.objectExists(meetingAfterRec.audioStoragePath);
  if (!audioInMinio) throw new Error('Opus không có trên MinIO sau worker');
  console.log('[smoke] MinIO opus verified');

  const segments = await MeetingRecordingSegment.find({ meetingId }).lean();
  console.log(`[smoke] Mongo segments: ${segments.length} (statuses: ${segments.map((s) => s.status).join(', ') || 'n/a'})`);

  // --- 2) STT transcript chunk (simulate realtime) ---
  await meetingAiSummaryService.appendTranscriptChunk(meetingId, {
    seq: 1,
    text: SMOKE_TRANSCRIPT,
    speakerId: hostId,
    displayName: 'Smoke Tester',
  });
  const afterStt = await Meeting.findById(meetingId).lean();
  if (!String(afterStt?.transcript || '').includes('Atrium')) {
    throw new Error('Transcript chunk không lưu vào MongoDB');
  }
  console.log(`[smoke] Transcript MongoDB: ${afterStt.transcript.slice(0, 80)}…`);

  // --- 3) AI summary ---
  await meetingAiSummaryService.triggerPostMeetingSummary(meetingId);
  console.log('[smoke] Đã publish voice.summary.process');

  const meetingAfterSummary = await waitFor(
    async () => {
      const m = await Meeting.findById(meetingId).lean();
      if (m?.summaryStatus === 'ready' && String(m.summary || '').trim()) return m;
      if (m?.summaryStatus === 'failed') throw new Error('Summary worker failed');
      return null;
    },
    'summary ready',
    SUMMARY_TIMEOUT_MS
  );
  console.log(`[smoke] Summary: ${meetingAfterSummary.summary.slice(0, 120)}…`);
  if (meetingAfterSummary.summaryStructured?.keyPoints?.length) {
    console.log(`[smoke] Key points: ${meetingAfterSummary.summaryStructured.keyPoints.slice(0, 3).join(' | ')}`);
  }

  console.log('\n=== PASS voice-recording-pipeline smoke ===');
  console.log(JSON.stringify({
    meetingId,
    recordingStatus: meetingAfterSummary.recordingStatus,
    audioStoragePath: meetingAfterSummary.audioStoragePath,
    hasTranscript: Boolean(meetingAfterSummary.transcript),
    summaryStatus: meetingAfterSummary.summaryStatus,
    segmentCount: segments.length,
  }, null, 2));

  await disconnectDB();
}

main().catch(async (err) => {
  console.error('[smoke] FAIL:', err.message || err);
  try {
    await disconnectDB();
  } catch {
    /* ignore */
  }
  process.exit(1);
});

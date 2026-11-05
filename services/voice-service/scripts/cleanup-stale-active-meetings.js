#!/usr/bin/env node
/**
 * Dọn các meeting voice còn status=active nhưng không còn phiên SFU (zombie sau lỗi cũ).
 *
 * Usage (từ repo root hoặc services/voice-service):
 *   node services/voice-service/scripts/cleanup-stale-active-meetings.js
 *   node services/voice-service/scripts/cleanup-stale-active-meetings.js --dry-run
 *   node services/voice-service/scripts/cleanup-stale-active-meetings.js --hard-delete
 */
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../../../.env') });

const { connectDB } = require('@enterprise/shared/config/mongo');
const Meeting = require('../src/models/Meeting');
const voiceRoomSessionService = require('../src/services/voiceRoomSession.service');

function parseArgs(argv) {
  const dryRun = argv.includes('--dry-run');
  const hardDelete = argv.includes('--hard-delete');
  let maxAgeHours = 0;
  for (const arg of argv) {
    if (arg.startsWith('--max-age-hours=')) {
      maxAgeHours = Number(arg.split('=')[1]) || 0;
    }
  }
  return { dryRun, hardDelete, maxAgeMs: maxAgeHours > 0 ? maxAgeHours * 60 * 60 * 1000 : 0 };
}

async function main() {
  const { dryRun, hardDelete, maxAgeMs } = parseArgs(process.argv.slice(2));
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('Thiếu MONGODB_URI trong services/voice-service/.env');
    process.exit(1);
  }

  await connectDB(uri, { exitOnFailure: true });

  const filter = { status: 'active' };
  if (maxAgeMs > 0) {
    filter.startTime = { $lt: new Date(Date.now() - maxAgeMs) };
  }

  const meetings = await Meeting.find(filter).sort({ startTime: 1 }).lean();
  console.log(`Tìm thấy ${meetings.length} meeting status=active${maxAgeMs ? ` (cũ hơn ${maxAgeMs / 3600000}h)` : ''}.`);

  if (!meetings.length) {
    process.exit(0);
  }

  let ended = 0;
  let deleted = 0;

  for (const meeting of meetings) {
    const started = meeting.startTime ? new Date(meeting.startTime) : null;
    const ageH = started ? ((Date.now() - started.getTime()) / 3600000).toFixed(1) : '?';
    const label = `${meeting._id} | ${meeting.title || meeting.lobbyRoomId || '—'} | age=${ageH}h`;

    if (dryRun) {
      console.log(`[dry-run] ${label}`);
      continue;
    }

    const result = await voiceRoomSessionService.finalizeOrphanMeeting(meeting, { hardDelete });
    if (!result) continue;
    if (result.deleted) {
      deleted += 1;
      console.log(`[deleted] ${label}`);
    } else {
      ended += 1;
      console.log(`[ended] ${label} duration=${result.durationSec}s`);
    }
  }

  if (!dryRun) {
    console.log(`Xong: ${ended} chuyển ended, ${deleted} đã xóa.`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

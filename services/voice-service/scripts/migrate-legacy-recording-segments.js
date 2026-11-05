/**
 * One-shot migration: legacy Meeting.audioStoragePath → MeetingRecordingSegment index 0.
 * Run: node scripts/migrate-legacy-recording-segments.js
 */
require('dotenv').config();
const { connectDB } = require('@enterprise/shared/config/mongo');
const Meeting = require('../src/models/Meeting');
const meetingRecordingSegmentService = require('../src/services/meetingRecordingSegment.service');

async function main() {
  await connectDB(process.env.MONGODB_URI);
  const rows = await Meeting.find({
    audioStoragePath: { $ne: null },
    recordingStatus: { $in: ['ready', 'processing', 'audio_expired'] },
  }).lean();

  let migrated = 0;
  for (const meeting of rows) {
    const seg = await meetingRecordingSegmentService.migrateLegacyAudioToSegment(meeting);
    if (seg) migrated += 1;
  }
  console.log(`migrate-legacy-recording-segments: ${migrated}/${rows.length}`);
  const mongoose = require('../src/db');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

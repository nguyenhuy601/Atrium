/**
 * One-off seed: overdue + confirmed remaining on sample tasks for EC scan/auto-propose.
 * Usage (in container): node scripts/seedExecutionControlAutoLoop.js [projectId]
 */
const mongoose = require('mongoose');

const PROJECT_ID = String(process.argv[2] || '6adf3610599dba0fefb438a6').trim();
const FALLBACK_ASSIGNEE = '6a4e099a135b2ab99925eb17';

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI missing');
  await mongoose.connect(uri);
  const tasks = mongoose.connection.db.collection('tasks');
  const now = new Date();
  const pastDue = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
  const projectOid = new mongoose.Types.ObjectId(PROJECT_ID);

  const candidates = await tasks
    .find({
      projectId: projectOid,
      isActive: true,
      status: { $nin: ['done', 'completed', 'closed', 'cancelled', 'canceled'] },
    })
    .limit(5)
    .toArray();

  console.log(
    'candidates',
    candidates.length,
    candidates.map((t) => ({
      id: String(t._id),
      title: String(t.title || '').slice(0, 60),
      due: t.dueDate,
      status: t.status,
    }))
  );

  if (!candidates.length) {
    throw new Error('NO_TASKS');
  }

  const ids = [];
  for (let i = 0; i < Math.min(3, candidates.length); i += 1) {
    const t = candidates[i];
    const assignee = t.assigneeId || new mongoose.Types.ObjectId(FALLBACK_ASSIGNEE);
    const upd = await tasks.updateOne(
      { _id: t._id },
      {
        $set: {
          dueDate: pastDue,
          remainingHours: 16 + i * 4,
          remainingSource: 'confirmed',
          remainingUpdatedAt: now,
          lastProgressAt: now,
          assigneeId: assignee,
          _ecSeedTag: 'auto-ux-loop-2026-11-03',
        },
      }
    );
    ids.push(String(t._id));
    console.log('seeded', String(t._id), 'mod', upd.modifiedCount);
  }
  console.log('SEEDED_IDS', JSON.stringify(ids));
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

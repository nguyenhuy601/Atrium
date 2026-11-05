const mongoose = require('mongoose');

const PROJECT_ID = String(process.argv[2] || '6adf3610599dba0fefb438a6').trim();

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const pid = new mongoose.Types.ObjectId(PROJECT_ID);
  const members = await mongoose.connection.db
    .collection('projectmembers')
    .find({ projectId: pid })
    .limit(30)
    .toArray();
  console.log(
    JSON.stringify(
      members.map((m) => ({
        userId: String(m.userId),
        roles: m.roles || m.roleKeys || m.role || m.projectRoles,
        email: m.email || null,
      })),
      null,
      2
    )
  );
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

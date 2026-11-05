/** Lookup emails for user ObjectIds (no secrets). */
const mongoose = require('mongoose');

async function main() {
  const ids = process.argv.slice(2).filter(Boolean);
  if (!ids.length) throw new Error('pass user ids');
  await mongoose.connect(process.env.MONGODB_URI);
  const oids = ids.map((id) => new mongoose.Types.ObjectId(id));
  const rows = await mongoose.connection.db
    .collection('users')
    .find({ _id: { $in: oids } })
    .project({ email: 1, systemRole: 1 })
    .toArray();
  console.log(
    JSON.stringify(
      rows.map((r) => ({
        id: String(r._id),
        email: r.email,
        systemRole: r.systemRole,
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

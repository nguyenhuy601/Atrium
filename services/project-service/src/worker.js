require('dotenv').config();
const { connectDB, connectRedis, disconnectDB, disconnectRedis, logger } = require('@enterprise/shared');
const {
  runTaskFromFileWorkerLoop,
  stopTaskFromFileWorker,
} = require('./workers/taskFromFileWorker');
const {
  runExecutionControlWorkerLoop,
  stopExecutionControlWorker,
} = require('./workers/executionControlWorker');

async function start() {
  await connectDB();
  connectRedis();
  runTaskFromFileWorkerLoop();
  runExecutionControlWorkerLoop();
  logger.info('[task-worker] started (task-from-file + execution-control)');
}

async function shutdown() {
  logger.info('[task-worker] shutting down');
  try {
    await stopExecutionControlWorker();
  } catch (e) {
    logger.error('[task-worker] stop execution-control worker failed:', e.message);
  }
  try {
    await stopTaskFromFileWorker();
  } catch (e) {
    logger.error('[task-worker] stop worker failed:', e.message);
  }
  try {
    await disconnectRedis();
    await disconnectDB();
  } catch {
    /* ignore */
  }
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start().catch((err) => {
  logger.error('[task-worker] failed to start:', err);
  process.exit(1);
});

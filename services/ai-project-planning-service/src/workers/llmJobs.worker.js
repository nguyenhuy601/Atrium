#!/usr/bin/env node
/**
 * Shared LlmJob worker (WHAT + HOW).
 * Opens 1–3 consumers as the queue grows. Each consumer holds at most 2 tasks.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const amqp = require('amqplib');
const { connectDB, disconnectDB } = require('@enterprise/shared');
const { assertQueuesResilient } = require('@enterprise/shared/messaging/rabbitQuorum');
const { waitForAmqpClose, sleep } = require('@enterprise/shared/messaging/rabbitReconnect');
const {
  resolveLlmJobsQueueName,
  resolveLlmJobsDlqName,
  LLM_JOB_SCHEMA_VERSION,
} = require('../llmJobs/llmJobContract');
const { processLlmJob } = require('../llmJobs/processLlmJob');
const { resolveWorkerScale, planListenerCount } = require('../runtime/workerScale');

const RECONCILE_MS = 1000;

const mongoUri =
  (process.env.AI_PROJECT_PLANNING_MONGODB_URI || '').trim() || process.env.MONGODB_URI;

async function connectAmqpWithRetry(url) {
  let attempt = 0;
  for (;;) {
    attempt += 1;
    try {
      return await amqp.connect(url);
    } catch (err) {
      const wait = Math.min(30000, 1000 * attempt);
      console.error(
        `[llm-jobs-worker] amqp connect failed attempt=${attempt}: ${err?.message || err}; retry ${wait}ms`
      );
      await sleep(wait);
    }
  }
}

async function handleDelivery(ch, msg) {
  if (!msg) return;
  let jobId = null;
  try {
    const payload = JSON.parse(msg.content.toString('utf8'));
    if (payload.schemaVersion && payload.schemaVersion !== LLM_JOB_SCHEMA_VERSION) {
      throw new Error(`schema_mismatch:${payload.schemaVersion}`);
    }
    jobId = payload.jobId;
    const out = await processLlmJob(jobId, { env: process.env });
    console.info(
      `[llm-jobs-worker] done id=${jobId} ok=${out.ok} err=${out.error || '-'}`
    );
    ch.ack(msg);
  } catch (err) {
    console.error(`[llm-jobs-worker] fail id=${jobId}`, err?.message || err);
    const requeue = !String(err?.message || '').startsWith('schema_mismatch');
    try {
      ch.nack(msg, false, requeue);
    } catch {
      /* ignore */
    }
  }
}

async function syncConsumers(conn, queue, dlq, consumers, scale) {
  // Fresh broker / first boot: declare before checkQueue (404 closes the channel).
  {
    const boot = await assertQueuesResilient(conn, [queue, dlq]);
    try {
      await boot.close();
    } catch {
      /* ignore */
    }
  }

  const probe = await conn.createChannel();
  let ready = 0;
  try {
    const info = await probe.checkQueue(queue);
    ready = info.messageCount || 0;
  } finally {
    try {
      await probe.close();
    } catch {
      /* ignore */
    }
  }

  const desired = planListenerCount(ready, consumers, scale);
  while (consumers.length < desired) {
    const ch = await assertQueuesResilient(conn, [queue, dlq]);
    await ch.prefetch(scale.tasksPerWorker);
    const entry = { ch, tag: null, inflight: 0 };
    const consume = await ch.consume(queue, (msg) => {
      entry.inflight += 1;
      Promise.resolve(handleDelivery(ch, msg)).finally(() => {
        entry.inflight = Math.max(0, entry.inflight - 1);
      });
    });
    entry.tag = consume.consumerTag;
    consumers.push(entry);
    console.log(
      `[llm-jobs-worker] consumers=${consumers.length} prefetch=${scale.tasksPerWorker} ready=${ready}`
    );
  }

  while (consumers.length > desired) {
    const idleAt = consumers.findIndex((entry, index) => index > 0 && entry.inflight === 0);
    if (idleAt < 0) break;
    const extra = consumers.splice(idleAt, 1)[0];
    try {
      await extra.ch.cancel(extra.tag);
    } catch {
      /* ignore */
    }
    try {
      await extra.ch.close();
    } catch {
      /* ignore */
    }
  }
  return desired;
}

async function runSession() {
  const url = String(process.env.RABBITMQ_URL || '').trim();
  if (!url) throw new Error('RABBITMQ_URL is not set');
  if (!mongoUri) throw new Error('MONGODB_URI / AI_PROJECT_PLANNING_MONGODB_URI required');

  process.env.LLM_JOBS_MEMORY = '0';
  process.env.LLM_JOBS_TRANSPORT = 'rabbit';

  await connectDB(mongoUri);
  const queue = resolveLlmJobsQueueName(process.env);
  const dlq = resolveLlmJobsDlqName(process.env);
  const scale = resolveWorkerScale(process.env);
  if (!(Number(process.env.LLM_MAX_INFLIGHT) >= 1)) {
    process.env.LLM_MAX_INFLIGHT = String(scale.maxWorkers * scale.tasksPerWorker);
  }
  const conn = await connectAmqpWithRetry(url);
  const consumers = [];
  await syncConsumers(conn, queue, dlq, consumers, scale);
  let scaling = false;
  const timer = setInterval(() => {
    if (scaling) return;
    scaling = true;
    syncConsumers(conn, queue, dlq, consumers, scale)
      .catch((err) => {
        console.error('[llm-jobs-worker] scale', err?.message || err);
      })
      .finally(() => {
        scaling = false;
      });
  }, RECONCILE_MS);

  await waitForAmqpClose(conn);
  clearInterval(timer);
  for (const entry of consumers.splice(0)) {
    try {
      await entry.ch.cancel(entry.tag);
    } catch {
      /* ignore */
    }
    try {
      await entry.ch.close();
    } catch {
      /* ignore */
    }
  }
  try {
    await conn.close();
  } catch {
    /* ignore */
  }
  await disconnectDB();
}

async function main() {
  for (;;) {
    try {
      await runSession();
    } catch (err) {
      console.error('[llm-jobs-worker] session ended', err?.message || err);
    }
    await sleep(2000);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[llm-jobs-worker] fatal', err);
    process.exit(1);
  });
}

module.exports = { runSession };

const Redis = require('ioredis');
const logger = require('../utils/logger');
const { buildIoredisOptions, describeRedisConnectionMode } = require('./redisConnection');

let redisClient = null;

function createIoredisFromOptions(options) {
  const { connectionUrl, ...rest } = options;
  if (connectionUrl) {
    return new Redis(connectionUrl, rest);
  }
  return new Redis(rest);
}

/**
 * Kết nối Redis
 * @param {Object} options - Redis connection options (override)
 * @returns {Redis}
 */
const connectRedis = (options = {}) => {
  if (!redisClient) {
    const clientOptions = buildIoredisOptions(options);
    const mode = describeRedisConnectionMode();
    logger.info(`Redis connecting (${mode})`);
    if (mode.startsWith('sentinel:')) {
      console.log(`[Redis] Using Sentinel (${mode})`);
    } else if (mode === 'url') {
      console.log('[Redis] Using REDIS_URL');
    } else {
      console.log(`[Redis] Using host connection (${mode})`);
    }

    redisClient = createIoredisFromOptions(clientOptions);

    redisClient.on('connect', () => {
      logger.info('Redis Connected');
    });

    redisClient.on('ready', () => {
      logger.info('Redis Ready');
    });

    redisClient.on('error', (err) => {
      logger.error('Redis Error:', err);
      // #region agent log
      fetch('http://host.docker.internal:7781/ingest/25418548-5637-4f11-a834-1c7c198bc9cb',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'67bd6d'},body:JSON.stringify({sessionId:'67bd6d',runId:'pre-fix',hypothesisId:'E',location:'shared/config/redis.js:error',message:'redis client error event',data:{errCode:err?.code||null,errMsg:String(err?.message||err).slice(0,160),status:redisClient?.status||null},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
    });

    redisClient.on('close', () => {
      logger.warn('Redis connection closed');
    });

    redisClient.on('reconnecting', (time) => {
      logger.info(`Redis reconnecting in ${time}ms`);
    });
  }

  return redisClient;
};

/**
 * Lấy Redis client
 * @returns {Redis}
 */
const getRedisClient = () => {
  if (!redisClient) {
    return connectRedis();
  }
  return redisClient;
};

/**
 * Đóng kết nối Redis
 */
const disconnectRedis = async () => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis connection closed');
  }
};

module.exports = {
  connectRedis,
  getRedisClient,
  disconnectRedis,
};

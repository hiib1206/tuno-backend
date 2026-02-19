import Redis from "ioredis";
import { env } from "./env";
import logger from "./logger";

/** Redis 클라이언트 인스턴스. */
const redis = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    if (times > 10) {
      logger.error("Redis 연결 실패. 프로세스 종료.");
      process.exit(1);
    }
    const delay = Math.min(times * 1000, 30000);
    logger.warn(`Redis 재연결 시도 ${times}/10 (${delay / 1000}초 후)`);
    return delay;
  },
});

redis.on("connect", () => {
  logger.info(`Redis connected to ${env.REDIS_HOST}:${env.REDIS_PORT}`);
});

redis.on("error", (err: Error) => {
  logger.error(`Redis Error: ${err.message}`);
});

/**
 * Pub/Sub 전용 Redis 클라이언트.
 *
 * @remarks
 * subscribe 모드에서는 GET/SET 등 일반 명령을 사용할 수 없으므로 별도 인스턴스가 필요하다.
 */
export const redisSub = redis.duplicate();

redisSub.on("error", (err: Error) => {
  logger.error(`Redis Subscriber Error: ${err.message}`);
});

export default redis;

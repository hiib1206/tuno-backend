import Redis from "ioredis";
import { env } from "./env";

const redis = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD,
});

redis.on("connect", () => {
  console.log(`✅ Redis connected to ${env.REDIS_HOST}:${env.REDIS_PORT}`);
});

redis.on("error", (err: Error) => {
  console.error(`❌ Redis Error: ${err.message}`);
});

// Pub/Sub 전용 클라이언트 (subscribe 모드에서는 GET/SET 등 일반 명령 사용 불가)
export const redisSub = redis.duplicate();

redisSub.on("error", (err: Error) => {
  console.error(`❌ Redis Subscriber Error: ${err.message}`);
});

export default redis;

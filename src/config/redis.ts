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

export default redis;

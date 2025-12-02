import Redis from "ioredis";
import { env } from "./env";

const redis = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  // password: process.env.REDIS_PASSWORD, // 설정된 경우에만
  retryStrategy: (times) => {
    // 재연결 전략: 최대 10번까지 시도
    if (times > 10) {
      //times가 11이면 재연결 중단
      console.log(times);
      console.error("❌ Redis 재연결 실패: 최대 재시도 횟수 초과");
      return null; // 재연결 중단
    }
    // 재시도 지연 시간: 최대 2초
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  // 요청 재시도: 각 명령이 실패했을 때 최대 3번까지 재시도
  // 기본값(20)보다 낮게 설정: 일시적 오류는 3~5번 재시도면 해결되며,
  // 과도한 재시도는 응답 지연을 유발하므로 빠른 실패 전략 채택
  maxRetriesPerRequest: 3,
  password: process.env.REDIS_PASSWORD,
});

redis.on("connect", () => {
  console.log("✅ Redis connected");
});

redis.on("ready", () => {
  console.log("✅ Redis ready");
});

redis.on("error", (err) => {
  console.error("❌ Redis Error:", err);
});

redis.on("close", () => {
  console.warn("⚠️ Redis connection closed");
});

redis.on("reconnecting", () => {
  console.log("🔄 Redis reconnecting...");
});

export default redis;

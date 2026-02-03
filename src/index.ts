import http from "http";
import app from "./app";
import { env } from "./config/env";
import prisma from "./config/prisma";
import redis, { redisSub } from "./config/redis";
import { startSchedulers } from "./scheduler";
import { initSSESubscriber } from "./service/sse.service";

const server = http.createServer(app);

server.listen(env.PORT, async () => {
  // Prisma 연결 초기화
  await prisma.$connect();
  console.log(`Server is running on port ${env.PORT}`);

  // SSE Redis Pub/Sub 구독 시작
  await initSSESubscriber();

  // 모든 스케줄러 시작
  startSchedulers();
});

// Graceful shutdown
process.on("SIGINT", async () => {
  await redisSub.quit();
  await redis.quit();
  console.log("🧹 Redis connections closed gracefully");

  // Prisma 연결도 종료하는 것이 좋습니다
  await prisma.$disconnect();
  console.log("🧹 Prisma connection closed gracefully");

  process.exit(0);
});

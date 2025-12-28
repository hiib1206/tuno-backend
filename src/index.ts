import http from "http";
import app from "./app";
import { env } from "./config/env";
import prisma from "./config/prisma";
import redis from "./config/redis";
import { startSchedulers } from "./scheduler";

const server = http.createServer(app);

server.listen(env.PORT, async () => {
  // Prisma 연결 초기화
  await prisma.$connect();
  console.log(`Server is running on port ${env.PORT}`);

  // 모든 스케줄러 시작
  startSchedulers();
});

// Graceful shutdown
process.on("SIGINT", async () => {
  await redis.quit();
  console.log("🧹 Redis connection closed gracefully");

  // Prisma 연결도 종료하는 것이 좋습니다
  await prisma.$disconnect();
  console.log("🧹 Prisma connection closed gracefully");

  process.exit(0);
});

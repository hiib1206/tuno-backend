import http from "http";
import app from "./app.js";
import { env } from "./config/env.js";
import prisma from "./config/prisma.js";
import redis from "./config/redis.js";

const server = http.createServer(app);

server.listen(env.PORT, async () => {
  // Prisma 연결 초기화
  await prisma.$connect();
  console.log(`Server is running on port ${env.PORT}`);
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

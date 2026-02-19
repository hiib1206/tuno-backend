import http from "http";
import app from "./app";
import { env } from "./config/env";
import logger from "./config/logger";
import prisma from "./config/prisma";
import redis, { redisSub } from "./config/redis";
import { startSchedulers } from "./scheduler";
import { initSSESubscriber } from "./shared/utils/sse-manager";

const server = http.createServer(app);

server.listen(env.BACKEND_PORT, async () => {
  await prisma.$connect();
  logger.info(`Server is running on port ${env.BACKEND_PORT}`);

  await initSSESubscriber();
  startSchedulers();
});

// ── Graceful Shutdown ──
let isShuttingDown = false;

const shutdown = async (signal: string) => {
  // 중복 호출 방지
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`${signal} received. Starting graceful shutdown...`);

  // 강제 종료 타임아웃
  const forceExit = setTimeout(() => {
    logger.error("Forced shutdown due to timeout");
    process.exit(1);
  }, 10_000);

  server.close(async () => {
    logger.info("HTTP server closed");

    try {
      await Promise.all([redisSub.quit(), redis.quit()]);
      logger.info("Redis connections closed");

      await prisma.$disconnect();
      logger.info("Database disconnected");

      clearTimeout(forceExit);
      process.exit(0);
    } catch (error) {
      logger.error("Error during cleanup", { error });
      process.exit(1);
    }
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// ── 미처리 에러 ──
process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled Rejection", { reason });
  shutdown("unhandledRejection");
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception", {
    message: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

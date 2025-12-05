import { PrismaClient } from "../generated/prisma/client";
import { env } from "./env";
import logger from "./logger";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

// 개발 환경에서 연결 상태 모니터링 및 유지
if (env.NODE_ENV === "development" || env.NODE_ENV === "production") {
  let connectionCheckCount = 0;

  // 주기적으로 연결 상태 확인 및 유지 (2분마다)
  // 이렇게 하면 연결이 끊어지기 전에 계속 사용 중임을 알려줌
  setInterval(async () => {
    try {
      const start = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      const duration = Date.now() - start;

      connectionCheckCount++;

      // 50ms 이상이면 로깅
      if (duration > 50) {
        logger.warn(
          `[PRISMA CONNECTION SLOW] ${duration}ms (check #${connectionCheckCount})`
        );
      }
    } catch (error) {
      logger.error(
        `[PRISMA CONNECTION FAILED] ${
          error instanceof Error ? error.message : String(error)
        }`
      );

      try {
        await prisma.$connect();
        logger.info(
          `[PRISMA RECONNECTED] after check #${connectionCheckCount}`
        );
      } catch (reconnectError) {
        logger.error(
          `[PRISMA RECONNECT FAILED] ${
            reconnectError instanceof Error
              ? reconnectError.message
              : String(reconnectError)
          }`
        );
      }
    }
  }, 60000); // 1분마다 확인 (연결 유지)
}

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;

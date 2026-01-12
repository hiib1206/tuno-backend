import { PrismaClient } from "../generated/prisma/client";
import { env } from "./env";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

// // 개발 환경에서 연결 상태 모니터링
// if (env.NODE_ENV === "development" || env.NODE_ENV === "production") {
//   let connectionCheckCount = 0;

//   let lastTickAt = Date.now();

//   setInterval(async () => {
//     const now = Date.now();

//     // ⬇️ 핵심: interval 드리프트
//     const drift = now - lastTickAt - 60000;
//     lastTickAt = now;

//     try {
//       const start = Date.now();
//       await prisma.$queryRaw`SELECT 1`;
//       const duration = Date.now() - start;

//       connectionCheckCount++;

//       logger.info(
//         `[PRISMA CHECK] query=${duration}ms drift=${drift}ms (#${connectionCheckCount})`
//       );

//       if (duration > 50) {
//         logger.warn(
//           `[PRISMA CONNECTION SLOW] ${duration}ms (drift=${drift}ms, check #${connectionCheckCount})`
//         );
//       }
//     } catch (error) {
//       logger.error(
//         `[PRISMA CONNECTION FAILED] ${
//           error instanceof Error ? error.message : String(error)
//         }`
//       );
//     }
//   }, 60000);
// }

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;

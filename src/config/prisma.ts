import { PrismaClient } from "../generated/prisma/client";
import { env } from "./env";

// 개발 환경에서 HMR로 인한 다중 인스턴스 생성을 방지한다.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/** Prisma 데이터베이스 클라이언트 인스턴스. */
const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;

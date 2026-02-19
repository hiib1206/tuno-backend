import cron from "node-cron";
import logger from "../config/logger";
import { syncViewCounts } from "./viewCountSync";

/** 모든 스케줄러를 시작한다. */
export const startSchedulers = (): void => {
  cron.schedule("*/5 * * * *", async () => {
    try {
      logger.info("[CRON] 조회수 동기화 작업 시작");
      await syncViewCounts();
    } catch (error) {
      logger.error(
        `[CRON] 조회수 동기화 작업 실패: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  });

  logger.info("[CRON] 조회수 동기화 스케줄러가 시작되었습니다. (5분마다 실행)");
};

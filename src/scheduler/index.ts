import cron from "node-cron";
import logger from "../config/logger";
import { syncViewCounts } from "./viewCountSync";

/**
 * 모든 스케줄러를 시작하는 함수
 * - 서버 시작 시 index.ts에서 호출
 */
export const startSchedulers = (): void => {
  // 조회수 동기화 스케줄러 (5분마다 실행)
  // cron 표현식: "*/5 * * * *" = 매 5분마다
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

  // 여기에 다른 스케줄러들을 추가할 수 있습니다
  // 예: cron.schedule("0 0 * * *", async () => { ... }); // 매일 자정
};

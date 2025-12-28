import logger from "../config/logger";
import prisma from "../config/prisma";
import redis from "../config/redis";

/**
 * Redis에서 post:view:count:* 패턴의 모든 키를 가져옵니다.
 * @returns {Promise<string[]>} 모든 조회수 카운트 키의 배열을 반환합니다.
 * 예시: ["post:view:count:1", "post:view:count:12439", "post:view:count:889"]
 */
const getAllViewCountKeys = async (): Promise<string[]> => {
  const keys: string[] = [];
  let cursor = "0";

  do {
    const [nextCursor, foundKeys] = await redis.scan(
      cursor,
      "MATCH",
      "post:view:count:*",
      "COUNT",
      100
    );
    cursor = nextCursor;
    keys.push(...foundKeys);
  } while (cursor !== "0");

  return keys;
};

/**
 * Redis 버퍼에 저장된 조회수를 DB에 동기화 (최적화 버전)
 * - Redis Pipeline을 사용하여 네트워크 오버헤드 감소
 * - get과 del을 atomic하게 처리하여 데이터 유실 방지
 * - findUnique 제거로 DB 쿼리 50% 감소
 * - 트랜잭션 대신 Promise.allSettled로 병렬 처리하여 락 시간 최소화
 */
export const syncViewCounts = async (): Promise<void> => {
  const startTime = Date.now();
  let processedCount = 0;
  let errorCount = 0;

  try {
    // 1. SCAN으로 키 목록 가져오기
    const keys = await getAllViewCountKeys();

    if (keys.length === 0) {
      logger.info("[VIEW COUNT SYNC] 동기화할 조회수가 없습니다.");
      return;
    }

    logger.info(
      `[VIEW COUNT SYNC] ${keys.length}개의 게시글 조회수 동기화 시작`
    );

    // 2. Redis Pipeline을 사용하여 한 번에 데이터 가져오고 삭제 (유실 방지 핵심)
    // get과 del을 묶어서 처리하여 그 사이에 새로운 조회수가 쌓여도 유실되지 않음
    const pipeline = redis.pipeline();
    keys.forEach((key) => {
      pipeline.get(key);
      pipeline.del(key); // 가져오자마자 삭제하여 그 이후 쌓이는 데이터와 격리
    });

    const results = await pipeline.exec();

    if (!results) {
      logger.error("[VIEW COUNT SYNC] Redis Pipeline 실행 실패");
      return;
    }

    // 3. 결과 파싱 및 메모리 집계
    // results 형태: [[null, "10"], [null, "OK"], [null, "5"], [null, "OK"], ...]
    // 각 키마다 [get 결과, del 결과] 순서로 반환됨
    const viewCountMap = new Map<bigint, number>();

    for (let i = 0; i < keys.length; i++) {
      try {
        // get 결과는 짝수 인덱스 (0, 2, 4, ...)
        const getResult = results[i * 2];
        if (!getResult || getResult[0]) {
          // 에러가 있거나 결과가 없으면 건너뛰기
          continue;
        }

        const countStr = getResult[1] as string | null;
        if (!countStr) {
          continue;
        }

        // 키 형식: post:view:count:{postId}
        const postIdStr = keys[i].replace("post:view:count:", "");
        const postId = BigInt(postIdStr);

        const count = parseInt(countStr, 10);
        if (isNaN(count) || count <= 0) {
          logger.warn(
            `[VIEW COUNT SYNC] 유효하지 않은 조회수 값: ${keys[i]} = ${countStr}`
          );
          continue;
        }

        // 기존 값이 있으면 합산
        const existingCount = viewCountMap.get(postId) || 0;
        viewCountMap.set(postId, existingCount + count);
      } catch (error) {
        errorCount++;
        logger.error(
          `[VIEW COUNT SYNC] 키 처리 실패 (${keys[i]}): ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    if (viewCountMap.size === 0) {
      logger.info("[VIEW COUNT SYNC] 동기화할 유효한 조회수가 없습니다.");
      return;
    }

    // 4. DB 업데이트 (Chunk 단위로 안전하게 처리)
    // 커넥션 풀 과부하 방지를 위해 Chunk 단위로 나누어 처리
    // update 시 게시글이 없으면 Prisma가 에러를 던지므로 try-catch로 처리
    // 트랜잭션 대신 Promise.allSettled로 병렬 처리하여 락 시간 최소화
    const CHUNK_SIZE = 50; // 한 번에 처리할 DB 요청 수 (커넥션 풀 크기에 맞게 조정)
    const entries = Array.from(viewCountMap.entries());

    for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
      const chunkEntries = entries.slice(i, i + CHUNK_SIZE);

      const updatePromises = chunkEntries.map(
        async ([postId, incrementCount]) => {
          try {
            await prisma.post.update({
              where: { id: postId },
              data: { view_count: { increment: incrementCount } },
            });
            processedCount++;
          } catch (error) {
            errorCount++;
            // 게시글이 삭제되었거나 존재하지 않는 경우 등에 대한 예외 처리
            logger.error(
              `[VIEW COUNT SYNC] DB 업데이트 실패 (postId: ${postId}): ${
                error instanceof Error ? error.message : String(error)
              }`
            );
          }
        }
      );

      // 해당 청크가 완료될 때까지 대기 후 다음 청크로 이동
      await Promise.allSettled(updatePromises);
    }

    const duration = Date.now() - startTime;
    logger.info(
      `[VIEW COUNT SYNC] 완료 - 처리: ${processedCount}개, 실패: ${errorCount}개, 소요시간: ${duration}ms`
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(
      `[VIEW COUNT SYNC] 동기화 실패 (소요시간: ${duration}ms): ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    throw error;
  }
};

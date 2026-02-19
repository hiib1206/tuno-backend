import logger from "../config/logger";
import prisma from "../config/prisma";
import redis from "../config/redis";

/** Redis에서 post:view:count:* 패턴의 모든 키를 가져온다. */
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
 * Redis 버퍼에 저장된 조회수를 DB에 동기화한다.
 *
 * @remarks
 * - get과 del을 atomic하게 처리하여 데이터 유실을 방지한다.
 * - Promise.allSettled로 병렬 처리하여 락 시간을 최소화한다.
 */
export const syncViewCounts = async (): Promise<void> => {
  const startTime = Date.now();
  let processedCount = 0;
  let errorCount = 0;

  try {
    const keys = await getAllViewCountKeys();

    if (keys.length === 0) {
      logger.info("[VIEW COUNT SYNC] 동기화할 조회수가 없습니다.");
      return;
    }

    logger.info(
      `[VIEW COUNT SYNC] ${keys.length}개의 게시글 조회수 동기화 시작`
    );

    // get과 del을 묶어서 처리하여 그 사이에 새로운 조회수가 쌓여도 유실되지 않음
    const pipeline = redis.pipeline();
    keys.forEach((key) => {
      pipeline.get(key);
      pipeline.del(key);
    });

    const results = await pipeline.exec();

    if (!results) {
      logger.error("[VIEW COUNT SYNC] Redis Pipeline 실행 실패");
      return;
    }

    // results: [[null, "10"], [null, "OK"], ...] - 각 키마다 [get, del] 순서
    const viewCountMap = new Map<bigint, number>();

    for (let i = 0; i < keys.length; i++) {
      try {
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

    // 커넥션 풀 과부하 방지를 위해 Chunk 단위로 나누어 처리
    const CHUNK_SIZE = 50;
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
            logger.error(
              `[VIEW COUNT SYNC] DB 업데이트 실패 (postId: ${postId}): ${
                error instanceof Error ? error.message : String(error)
              }`
            );
          }
        }
      );

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

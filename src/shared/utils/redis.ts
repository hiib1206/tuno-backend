import redis from "../../config/redis";

/**
 * 캐시 미스 시 뮤텍스 락을 사용해 thundering herd를 방지하며 값을 조회한다.
 *
 * @remarks
 * 동시 요청 중 하나만 fetcher를 실행하고, 나머지는 폴링으로 대기한다.
 * 락 TTL 내에 캐시가 채워지지 않으면 에러를 던진다.
 *
 * @typeParam T - 캐시할 데이터 타입
 * @param cacheKey - Redis 캐시 키
 * @param fetcher - 캐시 미스 시 실행할 비동기 함수
 * @param cacheTtlSec - 캐시 TTL(초)
 * @param lockTtlSec - 최대 락 유지 시간(초)
 * @returns 캐시된 값 또는 fetcher의 반환값
 * @throws {@link Error} 락 TTL 내에 캐시가 채워지지 않은 경우
 */
export async function getWithLock<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  cacheTtlSec: number = 1.5,
  lockTtlSec: number = 3
): Promise<T> {
  const cacheTtlMs = Math.round(cacheTtlSec * 1000);
  const lockTtlMs = Math.round(lockTtlSec * 1000);

  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const lockKey = `lock:${cacheKey}`;
  const acquired =
    (await redis.set(lockKey, "1", "PX", lockTtlMs, "NX")) === "OK";

  if (acquired) {
    try {
      // 락 대기 사이에 다른 요청이 캐시를 채웠을 수 있으므로 재확인한다.
      const cached2 = await redis.get(cacheKey);
      if (cached2) return JSON.parse(cached2);

      const data = await fetcher();
      await redis.set(cacheKey, JSON.stringify(data), "PX", cacheTtlMs);
      return data;
    } finally {
      await redis.del(lockKey);
    }
  }

  // Redis에는 네이티브 waiter가 없으므로 폴링 방식을 사용한다.
  const maxRetries = Math.ceil(lockTtlMs / 200);
  for (let i = 0; i < maxRetries; i++) {
    await new Promise((r) => setTimeout(r, 200));
    const retried = await redis.get(cacheKey);
    if (retried) return JSON.parse(retried);
  }

  throw new Error(`Cache fetch timeout: ${cacheKey}`);
}

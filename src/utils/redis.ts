import redis from "../config/redis";

/**
 * Redis 캐시 + 뮤텍스 lock 패턴
 * 캐시 미스 시 동시 요청 중 하나만 fetcher를 실행하고, 나머지는 대기 후 캐시를 재조회한다.
 */
export async function getWithLock<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  cacheTtlSec: number = 1.5,
  lockTtlSec: number = 3
): Promise<T> {
  const cacheTtlMs = Math.round(cacheTtlSec * 1000);
  const lockTtlMs = Math.round(lockTtlSec * 1000);

  // 1) 캐시 히트
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  // 2) lock 획득 시도
  const lockKey = `lock:${cacheKey}`;
  const acquired =
    (await redis.set(lockKey, "1", "PX", lockTtlMs, "NX")) === "OK";

  if (acquired) {
    try {
      // 3) double-check (lock 대기 사이에 다른 요청이 캐시를 채웠을 수 있음)
      const cached2 = await redis.get(cacheKey);
      if (cached2) return JSON.parse(cached2);

      // 4) API 호출 → 캐시 저장
      const data = await fetcher();
      await redis.set(cacheKey, JSON.stringify(data), "PX", cacheTtlMs);
      return data;
    } finally {
      await redis.del(lockKey);
    }
  }

  // 5) lock 못 잡은 요청 → 대기 후 캐시 재조회
  await new Promise((r) => setTimeout(r, 200));
  const retried = await redis.get(cacheKey);
  if (retried) return JSON.parse(retried);

  // 6) fallback: 그래도 없으면 직접 호출
  return fetcher();
}

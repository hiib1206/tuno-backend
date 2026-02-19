import prisma from "../../config/prisma";
import redis from "../../config/redis";
import { user_role } from "../../generated/prisma/enums";

/** 티어별 일일 AI 추론 허용 횟수 (0 = 무제한) */
export const DAILY_INFERENCE_LIMIT: Record<user_role, number> = {
  FREE: 5,
  PRO: 100,
  ADMIN: 0,
} as const;

/** Redis key prefix: 쿼터 카운터 */
export const QUOTA_REDIS_PREFIX = "quota:inference";

/**
 * KST(UTC+9) 기준 오늘 날짜 문자열을 반환한다.
 */
const getTodayKST = (): string => {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
};

/**
 * 다음 날 KST 자정 시각을 반환한다. (UTC 기준 밀리초)
 */
const getNextMidnightKST = (): number => {
  const nowKST = Date.now() + 9 * 60 * 60 * 1000;
  const tomorrowKST = new Date(nowKST);
  tomorrowKST.setUTCDate(tomorrowKST.getUTCDate() + 1);
  tomorrowKST.setUTCHours(0, 0, 0, 0);
  return tomorrowKST.getTime() - 9 * 60 * 60 * 1000; // UTC로 변환
};

/**
 * 다음 날 KST 자정까지 남은 초를 계산한다.
 */
const getTTLUntilMidnightKST = (): number => {
  return Math.ceil((getNextMidnightKST() - Date.now()) / 1000);
};

/**
 * 쿼터 리셋 시각을 반환한다. (Unix timestamp, 초 단위)
 */
export const getQuotaResetTimestamp = (): number => {
  return Math.floor(getNextMidnightKST() / 1000);
};

/**
 * 사용자의 오늘 쿼터 Redis 키를 반환한다.
 */
export const getQuotaRedisKey = (userId: number): string => {
  return `${QUOTA_REDIS_PREFIX}:${userId}:${getTodayKST()}`;
};

/**
 * 쿼터 카운트를 증가시킨다.
 *
 * @remarks
 * 첫 사용 시 KST 자정까지 TTL을 설정한다. 추론 성공 시 호출한다.
 */
export const incrementQuota = async (userId: number): Promise<number> => {
  const key = getQuotaRedisKey(userId);
  const newVal = await redis.incr(key);
  if (newVal === 1) {
    await redis.expire(key, getTTLUntilMidnightKST());
  }
  return newVal;
};

/**
 * 쿼터 카운트를 감소시킨다. (실패 시 환불용)
 */
export const decrementQuota = async (userId: number): Promise<void> => {
  const key = getQuotaRedisKey(userId);
  await redis.decr(key);
};

const ROLE_CACHE_PREFIX = "user:role";
const ROLE_CACHE_TTL = 300;

const validRoles = new Set<string>(Object.values(user_role));

/**
 * userId로 사용자 role을 조회한다.
 *
 * @remarks
 * Redis 캐시(5분)를 우선 사용하고, 캐시 미스 시 DB에서 조회 후 캐시한다.
 * 탈퇴한 사용자(deleted_at이 있는 경우)는 null을 반환한다.
 */
export const getUserRole = async (
  userId: number
): Promise<user_role | null> => {
  const cacheKey = `${ROLE_CACHE_PREFIX}:${userId}`;

  const cached = await redis.get(cacheKey);
  if (cached && validRoles.has(cached)) {
    return cached as user_role;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, deleted_at: true },
  });

  if (!user || user.deleted_at) {
    return null;
  }

  await redis.set(cacheKey, user.role, "EX", ROLE_CACHE_TTL);

  return user.role;
};

/**
 * 사용자 role 캐시를 무효화한다.
 *
 * @remarks
 * role이 변경될 때 (예: PRO 업그레이드) 호출한다.
 */
export const invalidateRoleCache = async (userId: number): Promise<void> => {
  const cacheKey = `${ROLE_CACHE_PREFIX}:${userId}`;
  await redis.del(cacheKey);
};

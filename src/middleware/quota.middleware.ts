import { NextFunction, Request, Response } from "express";
import redis from "../config/redis";
import { sendError } from "../utils/commonResponse";
import {
  DAILY_INFERENCE_LIMIT,
  getQuotaRedisKey,
  getQuotaResetTimestamp,
  getUserRole,
} from "../utils/role";
import { UserPayload } from "../utils/token";

/**
 * 다음 날 KST 자정까지 남은 초 계산
 */
const getTTLUntilMidnightKST = (): number => {
  const nowKST = Date.now() + 9 * 60 * 60 * 1000;
  const tomorrowKST = new Date(nowKST);
  tomorrowKST.setUTCDate(tomorrowKST.getUTCDate() + 1);
  tomorrowKST.setUTCHours(0, 0, 0, 0);
  return Math.ceil((tomorrowKST.getTime() - nowKST) / 1000);
};

/**
 * Redis Lua 스크립트: 원자적 check-and-increment
 * - 현재 값이 limit 이상이면 -1 반환 (초과)
 * - 아니면 INCR 후 새 값 반환
 * - 첫 사용 시 TTL 설정
 */
const LUA_CHECK_AND_INCR = `
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
if current >= tonumber(ARGV[1]) then
  return -1
end
local newVal = redis.call('INCR', KEYS[1])
if newVal == 1 then
  redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))
end
return newVal
`;

/**
 * 공통: 사용자 역할과 한도 정보 조회
 */
const getRoleAndLimit = async (req: Request, res: Response) => {
  const userId = (req.user as UserPayload)?.userId;
  if (!userId) {
    sendError(res, 401, "인증 정보가 존재하지 않습니다.");
    return null;
  }

  const role = req.userRole ?? (await getUserRole(userId));
  if (!role) {
    sendError(res, 401, "사용자를 찾을 수 없습니다.");
    return null;
  }

  if (!req.userRole) {
    req.userRole = role;
  }

  return { userId, role, limit: DAILY_INFERENCE_LIMIT[role] };
};

/**
 * Snapback용: 쿼터 체크만 (INCR 안 함)
 * 실제 카운트 증가는 컨트롤러에서 성공 시에만 수행
 */
export const checkInferenceQuota = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const info = await getRoleAndLimit(req, res);
    if (!info) return;

    const { userId, role, limit } = info;

    const resetTimestamp = getQuotaResetTimestamp();

    // 무제한 (ADMIN)
    if (limit === 0) {
      res.setHeader("X-Quota-Limit", "unlimited");
      res.setHeader("X-Quota-Remaining", "unlimited");
      res.setHeader("X-Quota-Reset", resetTimestamp.toString());
      return next();
    }

    const redisKey = getQuotaRedisKey(userId);
    const currentUsage = parseInt((await redis.get(redisKey)) ?? "0", 10);

    if (currentUsage >= limit) {
      res.setHeader("X-Quota-Limit", limit.toString());
      res.setHeader("X-Quota-Used", currentUsage.toString());
      res.setHeader("X-Quota-Remaining", "0");
      res.setHeader("X-Quota-Reset", resetTimestamp.toString());

      return sendError(
        res,
        429,
        `일일 AI 추론 한도를 초과했습니다. (${role} 등급: ${limit}회/일)`,
        { role, limit, used: currentUsage, remaining: 0 }
      );
    }

    // 체크만 통과 (아직 INCR 안 함)
    res.setHeader("X-Quota-Limit", limit.toString());
    res.setHeader("X-Quota-Used", currentUsage.toString());
    res.setHeader("X-Quota-Remaining", (limit - currentUsage).toString());
    res.setHeader("X-Quota-Reset", resetTimestamp.toString());

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Quant-signal용: 쿼터 체크 + 원자적 INCR
 * 비동기 추론이므로 요청 시점에 카운트 (실패 시 환불)
 */
export const checkAndIncrementQuota = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const info = await getRoleAndLimit(req, res);
    if (!info) return;

    const { userId, role, limit } = info;
    const resetTimestamp = getQuotaResetTimestamp();

    // 무제한 (ADMIN)
    if (limit === 0) {
      res.setHeader("X-Quota-Limit", "unlimited");
      res.setHeader("X-Quota-Remaining", "unlimited");
      res.setHeader("X-Quota-Reset", resetTimestamp.toString());
      return next();
    }

    const redisKey = getQuotaRedisKey(userId);
    const ttl = getTTLUntilMidnightKST();

    // 원자적 check-and-increment
    const result = (await redis.eval(
      LUA_CHECK_AND_INCR,
      1,
      redisKey,
      limit.toString(),
      ttl.toString()
    )) as number;

    if (result === -1) {
      const currentUsage = parseInt((await redis.get(redisKey)) ?? "0", 10);

      res.setHeader("X-Quota-Limit", limit.toString());
      res.setHeader("X-Quota-Used", currentUsage.toString());
      res.setHeader("X-Quota-Remaining", "0");
      res.setHeader("X-Quota-Reset", resetTimestamp.toString());

      return sendError(
        res,
        429,
        `일일 AI 추론 한도를 초과했습니다. (${role} 등급: ${limit}회/일)`,
        { role, limit, used: currentUsage, remaining: 0 }
      );
    }

    res.setHeader("X-Quota-Limit", limit.toString());
    res.setHeader("X-Quota-Used", result.toString());
    res.setHeader("X-Quota-Remaining", Math.max(0, limit - result).toString());
    res.setHeader("X-Quota-Reset", resetTimestamp.toString());

    next();
  } catch (error) {
    next(error);
  }
};

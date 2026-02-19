import { NextFunction, Request, Response } from "express";
import redis from "../config/redis";
import {
  TooManyRequestsError,
  UnauthorizedError,
} from "../shared/errors/AppError";
import {
  DAILY_INFERENCE_LIMIT,
  getQuotaRedisKey,
  getQuotaResetTimestamp,
  getUserRole,
} from "../shared/utils/role";
import { UserPayload } from "../shared/utils/token";

/**
 * 다음 날 KST 자정까지 남은 초를 계산한다.
 */
const getTTLUntilMidnightKST = (): number => {
  const nowKST = Date.now() + 9 * 60 * 60 * 1000;
  const tomorrowKST = new Date(nowKST);
  tomorrowKST.setUTCDate(tomorrowKST.getUTCDate() + 1);
  tomorrowKST.setUTCHours(0, 0, 0, 0);
  return Math.ceil((tomorrowKST.getTime() - nowKST) / 1000);
};

/**
 * 원자적 check-and-increment를 수행하는 Redis Lua 스크립트.
 *
 * @remarks
 * 현재 값이 limit 이상이면 -1을 반환하고, 그 외에는 INCR 후 새 값을 반환한다.
 * 첫 사용 시 TTL을 설정한다.
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
 * 사용자 역할과 한도 정보를 조회한다.
 *
 * @throws {@link UnauthorizedError} 인증 정보가 없거나 사용자를 찾을 수 없는 경우
 */
const getRoleAndLimit = async (req: Request) => {
  const userId = (req.user as UserPayload)?.userId;
  if (!userId) {
    throw new UnauthorizedError("인증 정보가 존재하지 않습니다.");
  }

  const role = req.userRole ?? (await getUserRole(userId));
  if (!role) {
    throw new UnauthorizedError("사용자를 찾을 수 없습니다.");
  }

  if (!req.userRole) {
    req.userRole = role;
  }

  return { userId, role, limit: DAILY_INFERENCE_LIMIT[role] };
};

/**
 * AI 추론 쿼터를 체크하는 미들웨어.
 *
 * @remarks
 * 카운트를 증가시키지 않고 체크만 수행한다.
 * 실제 카운트 증가는 컨트롤러에서 성공 시에만 수행한다. (Snapback용)
 *
 * @throws {@link UnauthorizedError} 인증 정보가 없거나 사용자를 찾을 수 없는 경우
 * @throws {@link TooManyRequestsError} 일일 한도를 초과한 경우
 */
export const checkInferenceQuota = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId, role, limit } = await getRoleAndLimit(req);

    const resetTimestamp = getQuotaResetTimestamp();

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

      throw new TooManyRequestsError(
        `일일 AI 추론 한도를 초과했습니다. (${role} 등급: ${limit}회/일)`,
        { role, limit, used: currentUsage, remaining: 0 }
      );
    }

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
 * AI 추론 쿼터를 체크하고 원자적으로 카운트를 증가시키는 미들웨어.
 *
 * @remarks
 * 비동기 추론이므로 요청 시점에 카운트를 증가시킨다. (Quant-signal용)
 * 추론 실패 시 환불 처리가 필요하다.
 *
 * @throws {@link UnauthorizedError} 인증 정보가 없거나 사용자를 찾을 수 없는 경우
 * @throws {@link TooManyRequestsError} 일일 한도를 초과한 경우
 */
export const checkAndIncrementQuota = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId, role, limit } = await getRoleAndLimit(req);
    const resetTimestamp = getQuotaResetTimestamp();

    if (limit === 0) {
      res.setHeader("X-Quota-Limit", "unlimited");
      res.setHeader("X-Quota-Remaining", "unlimited");
      res.setHeader("X-Quota-Reset", resetTimestamp.toString());
      return next();
    }

    const redisKey = getQuotaRedisKey(userId);
    const ttl = getTTLUntilMidnightKST();

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

      throw new TooManyRequestsError(
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

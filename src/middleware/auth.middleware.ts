import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { UnauthorizedError } from "../shared/errors/AppError";
import {
  clearRefreshTokenCookie,
  getRefreshToken,
  getUserIdAndDeviceIdFromToken,
  UserPayload,
} from "../shared/utils/token";

/**
 * Access token을 검증하고 req.user에 사용자 정보를 설정한다.
 *
 * @throws {@link UnauthorizedError} 토큰이 없거나, 형식이 잘못되었거나, 만료/무효한 경우
 */
export const verifyAccessTokenMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedError("access token이 존재하지 않습니다.");
    }

    const [bearer, token] = authHeader.split(" ");
    if (bearer !== "Bearer" || !token) {
      throw new UnauthorizedError("Bearer token 형식이 올바르지 않습니다.");
    }

    const decoded = jwt.verify(token, env.ACCESS_TOKEN_SECRET) as UserPayload;
    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }
    if (error instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError("만료된 access token입니다.");
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new UnauthorizedError("유효하지 않은 access token입니다.");
    }
    next(error);
  }
};

/**
 * 토큰이 있으면 검증하고, 없으면 통과시킨다.
 *
 * @remarks
 * 비로그인 사용자도 접근 가능하되 로그인 시 추가 기능을 제공하는 엔드포인트용.
 * 토큰이 있는데 유효하지 않으면 에러를 던진다.
 *
 * @throws {@link UnauthorizedError} 토큰이 존재하지만 만료/무효한 경우
 */
export const optionalVerifyAccessTokenMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return next();
    }

    const [bearer, token] = authHeader.split(" ");
    if (bearer !== "Bearer" || !token) {
      return next();
    }

    const decoded = jwt.verify(token, env.ACCESS_TOKEN_SECRET) as UserPayload;
    req.user = decoded;
    next();
  } catch (error) {
    // 토큰이 존재하는데 검증 실패한 경우만 에러 (토큰 없음은 위에서 통과)
    if (error instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError("만료된 access token입니다.");
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new UnauthorizedError("유효하지 않은 access token입니다.");
    }
    next(error);
  }
};

/**
 * Refresh token을 검증하고 req.user, req.refreshToken, req.deviceId를 설정한다.
 *
 * @remarks
 * 검증 실패 시 쿠키를 자동으로 삭제한다.
 *
 * @throws {@link UnauthorizedError} 토큰이 없거나, 형식이 잘못되었거나, DB에 존재하지 않는 경우
 */
export const verifyRefreshTokenMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      throw new UnauthorizedError("refresh token이 존재하지 않습니다.");
    }

    // 모든 UUID 버전을 허용하는 간단한 형식 검증
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(refreshToken)) {
      clearRefreshTokenCookie(res);
      throw new UnauthorizedError("유효하지 않은 refresh token 형식입니다.");
    }

    const tokenInfo = await getUserIdAndDeviceIdFromToken(refreshToken);
    if (!tokenInfo) {
      clearRefreshTokenCookie(res);
      throw new UnauthorizedError("유효하지 않은 refresh token입니다.");
    }

    const { userId, deviceId } = tokenInfo;

    const tokenData = await getRefreshToken(userId, deviceId, refreshToken);
    if (!tokenData) {
      clearRefreshTokenCookie(res);
      throw new UnauthorizedError("유효하지 않은 refresh token입니다.");
    }

    req.user = { userId };
    req.refreshToken = refreshToken;
    req.deviceId = deviceId;

    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }
    clearRefreshTokenCookie(res);
    next(error);
  }
};

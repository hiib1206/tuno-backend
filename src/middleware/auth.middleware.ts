import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { sendError } from "../utils/response";
import {
  clearRefreshTokenCookie,
  getRefreshToken,
  getUserIdAndDeviceIdFromToken,
  UserPayload,
} from "../utils/token";

// access token 검증
export const verifyAccessTokenMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return sendError(res, 401, "authorization header가 없습니다.");
    }

    const [bearer, token] = authHeader.split(" ");
    if (bearer !== "Bearer") {
      return sendError(res, 401, "Bearer token 형식이 올바르지 않습니다.");
    }
    if (!token) {
      return sendError(res, 401, "access token이 존재하지 않습니다.");
    }

    // decoded: { userId: number }
    const decoded = jwt.verify(token, env.ACCESS_TOKEN_SECRET) as UserPayload;
    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return sendError(res, 401, "만료된 access token입니다.");
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return sendError(res, 401, "유효하지 않은 access token입니다.");
    }
    next(error);
  }
};

// refresh token 검증
export const verifyRefreshTokenMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      return sendError(res, 401, "refresh token이 존재하지 않습니다.");
    }

    // UUID 형식 검증 (간단한 체크 모든 uuid버전 다 통과함)
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(refreshToken)) {
      clearRefreshTokenCookie(res);
      return sendError(res, 401, "유효하지 않은 refresh token 형식입니다.");
    }

    // tokenInfo: { userId: number, deviceId: string } or null
    const tokenInfo = await getUserIdAndDeviceIdFromToken(refreshToken);
    if (!tokenInfo) {
      clearRefreshTokenCookie(res);
      return sendError(res, 401, "유효하지 않은 refresh token입니다.");
    }

    const { userId, deviceId } = tokenInfo;

    // 실제 토큰 검증
    const tokenData = await getRefreshToken(userId, deviceId, refreshToken);
    if (!tokenData) {
      clearRefreshTokenCookie(res);
      return sendError(res, 401, "유효하지 않은 refresh token입니다.");
    }

    // req.user에 userId 설정
    req.user = { userId };

    // req에 추가 정보 저장 (필요시 사용)
    req.refreshToken = refreshToken;
    req.deviceId = deviceId;

    next();
  } catch (error) {
    clearRefreshTokenCookie(res);
    next(error);
  }
};

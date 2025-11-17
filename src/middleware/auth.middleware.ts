import { NextFunction, Request, Response } from "express";
import { sendError } from "../utils/response";
import { clearRefreshTokenCookie, JwtPayload } from "../utils/jwt";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

// access token 검증
export const verifyAccessToken = (
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

    const decoded = jwt.verify(token, env.ACCESS_TOKEN_SECRET) as JwtPayload;
    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return sendError(res, 401, "만료된 access token입니다.");
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return sendError(res, 401, "유효하지 않은 access token입니다.");
    }
    return sendError(
      res,
      500,
      "access token 검증 중 예상치 못한 에러가 발생했습니다."
    );
  }
};

// refresh token 검증
export const verifyRefreshToken = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      return sendError(res, 401, "refresh token이 존재하지 않습니다.");
    }

    const decoded = jwt.verify(
      refreshToken,
      env.REFRESH_TOKEN_SECRET
    ) as JwtPayload;
    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      clearRefreshTokenCookie(res);
      return sendError(res, 401, "만료된 refresh token입니다.");
    }
    if (error instanceof jwt.JsonWebTokenError) {
      clearRefreshTokenCookie(res);
      return sendError(res, 401, "유효하지 않은 refresh token입니다.");
    }
    return sendError(
      res,
      500,
      "refresh token 검증 중 예상치 못한 에러가 발생했습니다."
    );
  }
};

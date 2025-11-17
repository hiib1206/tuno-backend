import jwt, { SignOptions } from "jsonwebtoken";
import type { StringValue } from "ms";
import { env } from "../config/env";
import { CookieOptions, Response } from "express";
import ms from "ms";

// payload type
export interface JwtPayload {
  userId: number;
}

// refresh token cookie name
export const refreshTokenCookieName = "refreshToken";

// Refresh Token 쿠키 옵션
export const refreshTokenCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/api/auth",
};

// Access Token 생성
export const generateAccessToken = (userId: number): string => {
  const options: SignOptions = {
    expiresIn: env.ACCESS_TOKEN_EXPIRES_IN as StringValue,
  };
  return jwt.sign({ userId }, env.ACCESS_TOKEN_SECRET, options);
};

// Refresh Token 생성
export const generateRefreshToken = (userId: number): string => {
  const options: SignOptions = {
    expiresIn: env.REFRESH_TOKEN_EXPIRES_IN as StringValue,
  };
  return jwt.sign({ userId }, env.REFRESH_TOKEN_SECRET, options);
};

// Refresh Token 쿠키에 저장
export const setRefreshTokenCookie = (res: Response, token: string) => {
  res.cookie(refreshTokenCookieName, token, {
    ...refreshTokenCookieOptions,
    maxAge: ms(env.REFRESH_TOKEN_EXPIRES_IN as ms.StringValue),
  });
};

// Refresh Token 쿠키에서 제거
export const clearRefreshTokenCookie = (res: Response) => {
  res.clearCookie(refreshTokenCookieName, refreshTokenCookieOptions);
};

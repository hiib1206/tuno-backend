import { createHash, randomUUID } from "crypto";
import { CookieOptions, Request, Response } from "express";
import jwt, { SignOptions } from "jsonwebtoken";
import type { StringValue } from "ms";
import ms from "ms";
import { env } from "../config/env";
import redis from "../config/redis";

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
  path: "/",
};

// Access Token 생성 (JWT)
export const generateAccessToken = (userId: number): string => {
  const options: SignOptions = {
    expiresIn: env.ACCESS_TOKEN_EXPIRES_IN as StringValue,
  };
  return jwt.sign({ userId }, env.ACCESS_TOKEN_SECRET, options);
};

// Refresh Token 생성 (UUID)
export const generateRefreshToken = (): string => {
  return randomUUID();
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

// Device ID 추출 (헤더에서 가져오거나 기본값 사용)
export const getDeviceId = (req: Request): string => {
  return (req.headers["x-device-id"] as string) || "web";
};

// Client IP 추출
export const getClientIp = (req: Request): string => {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    (req.headers["x-real-ip"] as string) ||
    req.socket.remoteAddress ||
    "unknown"
  );
};

// User Agent 추출
export const getUserAgent = (req: Request): string => {
  return req.headers["user-agent"] || "unknown";
};

// Refresh Token을 SHA256 해시로 변환
const hashRefreshToken = (token: string): string => {
  return createHash("sha256").update(token).digest("hex");
};

// Redis Key 생성
const getRefreshTokenKey = (userId: number, deviceId: string): string => {
  return `refresh_token:${userId}:${deviceId}`;
};

// 토큰 해시로 userId와 deviceId를 찾기 위한 인덱스 Key 생성
const getTokenIndexKey = (hashedToken: string): string => {
  return `refresh_token_index:${hashedToken}`;
};

// Refresh Token을 Redis에 저장
export const saveRefreshToken = async (
  userId: number,
  deviceId: string,
  refreshToken: string,
  userAgent: string,
  ip: string,
  expiresIn: string
): Promise<void> => {
  const key = getRefreshTokenKey(userId, deviceId);
  const hashedToken = hashRefreshToken(refreshToken);
  const expireSeconds = Math.floor(ms(expiresIn as ms.StringValue) / 1000);

  // 기존 토큰이 있다면 인덱스에서 먼저 삭제
  // 사용중인 redis 저장구조
  // key: refresh_token:userId:deviceId
  // value: { token: hashedToken, ua: userAgent, ip: ip }
  // indexKey: refresh_token_index:hashedToken
  const existingData = await redis.hgetall(key);
  if (existingData && existingData.token) {
    const oldIndexKey = getTokenIndexKey(existingData.token);
    await redis.del(oldIndexKey);
  }

  // 메인 데이터 저장
  await redis.hset(key, {
    token: hashedToken,
    ua: userAgent,
    ip: ip,
  });
  await redis.expire(key, expireSeconds);

  // 인덱스 저장 (토큰 해시 -> userId:deviceId 매핑)
  const indexKey = getTokenIndexKey(hashedToken);
  await redis.set(indexKey, `${userId}:${deviceId}`, "EX", expireSeconds);
};

// 토큰 해시로 userId와 deviceId 찾는 함수
export const getUserIdAndDeviceIdFromToken = async (
  refreshToken: string
): Promise<{ userId: number; deviceId: string } | null> => {
  const hashedToken = hashRefreshToken(refreshToken);
  const indexKey = getTokenIndexKey(hashedToken);
  // indexKey: refresh_token_index:hashedToken
  // value: userId:deviceId
  const value = await redis.get(indexKey);

  if (!value) {
    return null;
  }

  const [userId, deviceId] = value.split(":");
  return {
    userId: parseInt(userId, 10),
    deviceId: deviceId,
  };
};

// Refresh Token 조회 및 검증
export const getRefreshToken = async (
  userId: number,
  deviceId: string,
  refreshToken: string
): Promise<{ token: string; ua: string; ip: string } | null> => {
  // key: refresh_token:userId:deviceId
  const key = getRefreshTokenKey(userId, deviceId);
  const hashedToken = hashRefreshToken(refreshToken);

  // data: { token: hashedToken, ua: userAgent, ip: ip } or (데이터가 없으면 null)
  const data = await redis.hgetall(key);
  if (!data || Object.keys(data).length === 0) {
    return null;
  }

  if (data.token !== hashedToken) {
    return null;
  }

  return {
    token: data.token,
    ua: data.ua,
    ip: data.ip,
  };
};

// Refresh Token 삭제
export const deleteRefreshToken = async (
  userId: number,
  deviceId: string
): Promise<void> => {
  const key = getRefreshTokenKey(userId, deviceId);
  const data = await redis.hgetall(key);

  // 인덱스도 함께 삭제
  if (data && data.token) {
    const indexKey = getTokenIndexKey(data.token);
    await redis.del(indexKey);
  }

  await redis.del(key);
};

// 사용자의 모든 Refresh Token 삭제
export const deleteAllRefreshTokens = async (userId: number): Promise<void> => {
  const pattern = `refresh_token:${userId}:*`;
  const keys = await redis.keys(pattern);

  if (keys.length > 0) {
    // 각 키에서 토큰 해시를 가져와서 인덱스도 삭제
    const indexKeys: string[] = [];
    for (const key of keys) {
      const data = await redis.hgetall(key);
      if (data && data.token) {
        indexKeys.push(getTokenIndexKey(data.token));
      }
    }

    // 인덱스와 메인 키 모두 삭제
    if (indexKeys.length > 0) {
      await redis.del(...indexKeys);
    }
    await redis.del(...keys);
  }
};

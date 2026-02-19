import { createHash, randomUUID } from "crypto";
import { CookieOptions, Response } from "express";
import jwt, { SignOptions } from "jsonwebtoken";
import type { StringValue } from "ms";
import ms from "ms";
import { env } from "../../config/env";
import redis from "../../config/redis";

/** Access Token JWT 페이로드 타입. */
export interface UserPayload {
  userId: number;
}

/** Refresh Token 쿠키 이름. */
export const refreshTokenCookieName = "refreshToken";

/** Refresh Token 쿠키 옵션. */
export const refreshTokenCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
};

/** JWT Access Token을 생성한다. */
export const generateAccessToken = (userId: number): string => {
  const options: SignOptions = {
    expiresIn: env.ACCESS_TOKEN_EXPIRES_IN as StringValue,
  };
  return jwt.sign({ userId }, env.ACCESS_TOKEN_SECRET, options);
};

/** UUID 기반 Refresh Token을 생성한다. */
export const generateRefreshToken = (): string => {
  return randomUUID();
};

/** Refresh Token을 쿠키에 저장한다. */
export const setRefreshTokenCookie = (res: Response, token: string) => {
  res.cookie(refreshTokenCookieName, token, {
    ...refreshTokenCookieOptions,
    maxAge: ms(env.REFRESH_TOKEN_EXPIRES_IN as ms.StringValue),
  });
};

/** Refresh Token 쿠키를 삭제한다. */
export const clearRefreshTokenCookie = (res: Response) => {
  res.clearCookie(refreshTokenCookieName, refreshTokenCookieOptions);
};

const hashRefreshToken = (token: string): string => {
  return createHash("sha256").update(token).digest("hex");
};

const getRefreshTokenKey = (userId: number, deviceId: string): string => {
  return `refresh_token:${userId}:${deviceId}`;
};

const getTokenIndexKey = (hashedToken: string): string => {
  return `refresh_token_index:${hashedToken}`;
};

/**
 * Refresh Token을 Redis에 저장한다.
 *
 * @remarks
 * 기존 토큰이 있다면 인덱스에서 먼저 삭제하고 새 토큰을 저장한다.
 */
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

  const existingData = await redis.hgetall(key);
  if (existingData && existingData.token) {
    const oldIndexKey = getTokenIndexKey(existingData.token);
    await redis.del(oldIndexKey);
  }

  await redis.hset(key, {
    token: hashedToken,
    ua: userAgent,
    ip: ip,
    createdAt: new Date().toISOString(),
  });
  await redis.expire(key, expireSeconds);

  const indexKey = getTokenIndexKey(hashedToken);
  await redis.set(indexKey, `${userId}:${deviceId}`, "EX", expireSeconds);
};

/** 토큰 해시로 userId와 deviceId를 조회한다. */
export const getUserIdAndDeviceIdFromToken = async (
  refreshToken: string
): Promise<{ userId: number; deviceId: string } | null> => {
  const hashedToken = hashRefreshToken(refreshToken);
  const indexKey = getTokenIndexKey(hashedToken);
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

/** Refresh Token을 조회하고 검증한다. */
export const getRefreshToken = async (
  userId: number,
  deviceId: string,
  refreshToken: string
): Promise<{
  token: string;
  ua: string;
  ip: string;
  createdAt: string;
} | null> => {
  const key = getRefreshTokenKey(userId, deviceId);
  const hashedToken = hashRefreshToken(refreshToken);

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
    createdAt: data.createdAt,
  };
};

/**
 * Refresh Token을 삭제한다.
 *
 * @remarks
 * 인덱스도 함께 삭제한다.
 */
export const deleteRefreshToken = async (
  userId: number,
  deviceId: string
): Promise<void> => {
  const key = getRefreshTokenKey(userId, deviceId);
  const data = await redis.hgetall(key);

  if (data && data.token) {
    const indexKey = getTokenIndexKey(data.token);
    await redis.del(indexKey);
  }

  await redis.del(key);
};

/**
 * 사용자의 모든 Refresh Token을 삭제한다.
 *
 * @remarks
 * 인덱스도 함께 삭제한다.
 */
export const deleteAllRefreshTokens = async (userId: number): Promise<void> => {
  const pattern = `refresh_token:${userId}:*`;
  const keys = await redis.keys(pattern);

  if (keys.length > 0) {
    const indexKeys: string[] = [];
    for (const key of keys) {
      const data = await redis.hgetall(key);
      if (data && data.token) {
        indexKeys.push(getTokenIndexKey(data.token));
      }
    }

    if (indexKeys.length > 0) {
      await redis.del(...indexKeys);
    }
    await redis.del(...keys);
  }
};

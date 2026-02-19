import axios from "axios";
import { env } from "../../config/env";
import logger from "../../config/logger";
import redis from "../../config/redis";
import type { LSCachedToken, LSTokenResponse } from "./commonTypes";
import { LS_BASE_URL, LS_REDIS_KEY, TOKEN_CONFIG } from "./constants";
import { LSTokenError } from "./errors";

/**
 * 유효한 토큰을 조회한다.
 *
 * @remarks
 * 캐시된 토큰이 유효하면 반환하고, 만료 임박 시 갱신한다.
 *
 * @throws {@link LSTokenError} 토큰 갱신 실패 시
 */
export const getValidToken = async (): Promise<string> => {
  const cachedToken = await getCachedToken();

  if (cachedToken && !isTokenExpiringSoon(cachedToken)) {
    return cachedToken.accessToken;
  }

  return await refreshTokenWithLock();
};

/**
 * 토큰을 강제로 갱신한다.
 *
 * @throws {@link LSTokenError} 토큰 갱신 실패 시
 */
export const forceRefreshToken = async (): Promise<string> => {
  return await refreshTokenWithLock();
};

/** 캐시된 토큰을 삭제한다. */
export const clearCachedToken = async (): Promise<void> => {
  await redis.del(LS_REDIS_KEY.TOKEN);
};

const getCachedToken = async (): Promise<LSCachedToken | null> => {
  const data = await redis.get(LS_REDIS_KEY.TOKEN);

  if (!data) return null;

  try {
    return JSON.parse(data) as LSCachedToken;
  } catch {
    return null;
  }
};

const isTokenExpiringSoon = (token: LSCachedToken): boolean => {
  const now = Date.now();
  return token.expiresAt - now < TOKEN_CONFIG.REFRESH_BUFFER_MS;
};

/**
 * 분산 락을 사용하여 토큰을 갱신한다.
 *
 * @remarks
 * 동시 요청 시 하나만 갱신하고 나머지는 완료를 대기한다.
 */
const refreshTokenWithLock = async (): Promise<string> => {
  const lockAcquired = await acquireLock();

  if (!lockAcquired) {
    return await waitForTokenRefresh();
  }

  try {
    const tokenResponse = await requestNewToken();
    await cacheToken(tokenResponse);

    return tokenResponse.access_token;
  } finally {
    await releaseLock();
  }
};

/** @throws {@link LSTokenError} 토큰 발급 요청 실패 시 */
const requestNewToken = async (): Promise<LSTokenResponse> => {
  try {
    const response = await axios.post<LSTokenResponse>(
      `${LS_BASE_URL}/oauth2/token`,
      new URLSearchParams({
        grant_type: "client_credentials",
        appkey: env.LS_APP_KEY,
        appsecretkey: env.LS_SECRET_KEY,
        scope: "oob",
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        timeout: 5000,
      }
    );

    return response.data;
  } catch (error) {
    logger.error("LS token request failed:", error);
    throw new LSTokenError("토큰 발급 요청 실패");
  }
};

const cacheToken = async (tokenResponse: LSTokenResponse): Promise<void> => {
  const ttlSeconds = tokenResponse.expires_in;
  const expiresAt = Date.now() + ttlSeconds * 1000;

  const cachedToken: LSCachedToken = {
    accessToken: tokenResponse.access_token,
    expiresAt,
  };

  if (ttlSeconds > 0) {
    await redis.set(
      LS_REDIS_KEY.TOKEN,
      JSON.stringify(cachedToken),
      "EX",
      ttlSeconds
    );
  }
};

/** @throws {@link LSTokenError} 대기 타임아웃 시 */
const waitForTokenRefresh = async (): Promise<string> => {
  for (let i = 0; i < TOKEN_CONFIG.LOCK_MAX_RETRIES; i++) {
    await delay(TOKEN_CONFIG.LOCK_RETRY_DELAY_MS);

    const cachedToken = await getCachedToken();
    if (cachedToken && !isTokenExpiringSoon(cachedToken)) {
      return cachedToken.accessToken;
    }
  }

  throw new LSTokenError("토큰 갱신 대기 타임아웃");
};

const acquireLock = async (): Promise<boolean> => {
  const result = await redis.set(
    LS_REDIS_KEY.TOKEN_LOCK,
    "1",
    "PX",
    TOKEN_CONFIG.LOCK_TTL_MS,
    "NX"
  );
  return result === "OK";
};

const releaseLock = async (): Promise<void> => {
  await redis.del(LS_REDIS_KEY.TOKEN_LOCK);
};

const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

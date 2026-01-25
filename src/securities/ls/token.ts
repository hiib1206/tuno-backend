import axios from "axios";
import { env } from "../../config/env";
import logger from "../../config/logger";
import redis from "../../config/redis";
import type { LSCachedToken, LSTokenResponse } from "./commonTypes";
import { LS_BASE_URL, LS_REDIS_KEY, TOKEN_CONFIG } from "./constants";
import { LSTokenError } from "./errors";

// ===== 핵심 함수 =====

/**
 * 유효한 토큰 조회 (캐시 우선, 필요시 갱신)
 */
export const getValidToken = async (): Promise<string> => {
  const cachedToken = await getCachedToken();

  // 캐시된 토큰이 유효하면 반환
  if (cachedToken && !isTokenExpiringSoon(cachedToken)) {
    return cachedToken.accessToken;
  }

  // 토큰 갱신 필요 - 락 획득 후 갱신
  return await refreshTokenWithLock();
};

/**
 * 토큰 강제 갱신 (에러 발생 시 사용)
 */
export const forceRefreshToken = async (): Promise<string> => {
  return await refreshTokenWithLock();
};

/**
 * 캐시된 토큰 삭제
 */
export const clearCachedToken = async (): Promise<void> => {
  await redis.del(LS_REDIS_KEY.TOKEN);
};

// ===== 내부 함수 =====

/**
 * Redis에서 캐시된 토큰 조회
 */
const getCachedToken = async (): Promise<LSCachedToken | null> => {
  const data = await redis.get(LS_REDIS_KEY.TOKEN);

  if (!data) return null;

  try {
    return JSON.parse(data) as LSCachedToken;
  } catch {
    return null;
  }
};

/**
 * 토큰 만료 임박 여부 확인
 */
const isTokenExpiringSoon = (token: LSCachedToken): boolean => {
  const now = Date.now();
  return token.expiresAt - now < TOKEN_CONFIG.REFRESH_BUFFER_MS;
};

/**
 * 락을 사용한 토큰 갱신 (동시 요청 방지)
 */
const refreshTokenWithLock = async (): Promise<string> => {
  // 락 획득 시도
  const lockAcquired = await acquireLock();

  if (!lockAcquired) {
    // 락 획득 실패 - 다른 프로세스가 갱신 중
    return await waitForTokenRefresh();
  }

  try {
    // 토큰 발급 API 호출
    const tokenResponse = await requestNewToken();

    // Redis에 저장
    await cacheToken(tokenResponse);

    return tokenResponse.access_token;
  } finally {
    // 락 해제
    await releaseLock();
  }
};

/**
 * LS증권 토큰 발급 API 호출
 */
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

/**
 * 토큰을 Redis에 캐싱
 */
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

/**
 * 다른 프로세스의 토큰 갱신 완료 대기
 */
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

// ===== 유틸리티 함수 =====

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

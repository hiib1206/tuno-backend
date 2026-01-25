// LS증권 API Base URL
export const LS_BASE_URL = "https://openapi.ls-sec.co.kr:8080";

// Redis 키
export const LS_REDIS_KEY = {
  TOKEN: "securities:ls:token",
  TOKEN_LOCK: "securities:ls:token:lock",
} as const;

// 토큰 설정
export const TOKEN_CONFIG = {
  REFRESH_BUFFER_MS: 30 * 60 * 1000, // 만료 30분 전 갱신
  LOCK_TTL_MS: 10 * 1000, // 락 TTL 10초
  LOCK_RETRY_DELAY_MS: 100, // 락 대기 시 재시도 간격
  LOCK_MAX_RETRIES: 50, // 락 최대 재시도 횟수
} as const;

// HTTP 설정
export const HTTP_CONFIG = {
  DEFAULT_TIMEOUT: 10000, // 10초
} as const;

// API 경로
export const API_PATH = {
  TOKEN: "/oauth2/token",
  MARKET_DATA: "/stock/market-data",
  INVEST_INFO: "/stock/investinfo",
  SECTOR: "/stock/sector",
} as const;

// ===== 토큰 관련 타입 =====
export type LSTokenResponse = {
  access_token: string;
  token_type: string; // "Bearer"
  expires_in: number; // 86400 (초)
  scope: string; // "oob"
};

export type LSCachedToken = {
  accessToken: string;
  expiresAt: number; // Unix timestamp (ms)
};

// ===== 연속조회 타입 =====
export type LSContinuation = {
  trCont: "Y" | "N";
  trContKey: string;
};

export type LSResponseHeaders = {
  trCont: "Y" | "N" | null;
  trContKey: string | null;
};

export type LSPaginatedResult<T> = {
  data: T;
  hasMore: boolean;
  nextKey?: string;
};

// ===== 요청 옵션 타입 =====
export type LSRequestOptions<TBody = Record<string, unknown>> = {
  trCode: string; // tr_cd: t1305, t8407, t8425 등
  path: string; // /stock/market-data 등
  body: TBody;
  continuation?: LSContinuation;
  timeout?: number;
};

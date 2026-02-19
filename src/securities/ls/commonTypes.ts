/** LS증권 토큰 발급 응답. */
export type LSTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
};

/** 캐시된 LS증권 토큰. */
export type LSCachedToken = {
  accessToken: string;
  expiresAt: number;
};

/** LS증권 연속조회 정보. */
export type LSContinuation = {
  trCont: "Y" | "N";
  trContKey: string;
};

/** LS증권 응답 헤더. */
export type LSResponseHeaders = {
  trCont: "Y" | "N" | null;
  trContKey: string | null;
};

/** LS증권 페이지네이션 결과. */
export type LSPaginatedResult<T> = {
  data: T;
  hasMore: boolean;
  nextKey?: string;
};

/** LS증권 API 요청 옵션. */
export type LSRequestOptions<TBody = Record<string, unknown>> = {
  trCode: string;
  path: string;
  body: TBody;
  continuation?: LSContinuation;
  timeout?: number;
};

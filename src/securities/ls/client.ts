import axios, { AxiosInstance } from "axios";
import logger from "../../config/logger";
import type {
  LSPaginatedResult,
  LSRequestOptions,
  LSResponseHeaders,
} from "./commonTypes";
import { HTTP_CONFIG, LS_BASE_URL, TR_RATE_LIMIT_MS } from "./constants";
import { LSError } from "./errors";
import { forceRefreshToken, getValidToken } from "./token";

// TR별 인메모리 rate limiter
const trLastCallTime = new Map<string, number>();
const trQueue = new Map<string, Promise<void>>();

async function waitForRateLimit(trCode: string): Promise<void> {
  const intervalMs = TR_RATE_LIMIT_MS[trCode] ?? TR_RATE_LIMIT_MS.default;

  // 이전 대기열이 끝날 때까지 기다린 뒤, 간격 보장
  const prev = trQueue.get(trCode) ?? Promise.resolve();

  let resolve: () => void;
  const current = new Promise<void>((r) => {
    resolve = r;
  });
  trQueue.set(trCode, current);

  await prev;

  const now = Date.now();
  const last = trLastCallTime.get(trCode) ?? 0;
  const wait = Math.max(0, intervalMs - (now - last));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));

  trLastCallTime.set(trCode, Date.now());
  resolve!();
}

// Axios 인스턴스
const axiosInstance: AxiosInstance = axios.create({
  baseURL: LS_BASE_URL,
  timeout: HTTP_CONFIG.DEFAULT_TIMEOUT,
  headers: {
    "Content-Type": "application/json;charset=UTF-8",
  },
});

/**
 * 응답 헤더에서 연속조회 정보 추출
 */
const extractResponseHeaders = (
  headers: Record<string, unknown>
): LSResponseHeaders => {
  return {
    // 연속 거래 여부
    trCont: (headers["tr_cont"] as "Y" | "N") || null,
    // 연속 거래 키
    trContKey: (headers["tr_cont_key"] as string) || null,
  };
};

/**
 * LS증권 API 요청 (단건)
 */
export const lsRequest = async <T>(
  options: LSRequestOptions,
  retryOnTokenError: boolean = true
): Promise<T> => {
  const { trCode, path, body, continuation, timeout } = options;

  // TR별 호출 간격 보장
  await waitForRateLimit(trCode);

  try {
    const token = await getValidToken();

    const headers: Record<string, string> = {
      "content-type": "application/json; charset=utf-8",
      authorization: `Bearer ${token}`,
      tr_cd: trCode,
      tr_cont: continuation?.trCont || "N",
    };

    // 연속조회 헤더 추가
    if (continuation?.trCont === "Y" && continuation?.trContKey) {
      headers["tr_cont_key"] = continuation.trContKey;
    }

    const response = await axiosInstance.post<T>(path, body, {
      headers,
      timeout: timeout ?? HTTP_CONFIG.DEFAULT_TIMEOUT,
    });

    return response.data;
  } catch (error) {
    // 토큰 에러 시 갱신 후 재시도
    if (retryOnTokenError && axios.isAxiosError(error)) {
      const rspCd = (error.response?.data as { rsp_cd?: string })?.rsp_cd;
      if (error.response?.status === 401 || rspCd === "IGW00121") {
        logger.warn(`LS token error (${error.response?.status}, ${rspCd}), refreshing`);
        await forceRefreshToken();
        return lsRequest<T>(options, false);
      }
    }

    // Axios 에러를 LSError로 래핑
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const data = error.response?.data as { rsp_msg?: string } | undefined;
      throw new LSError(
        String(status ?? "NETWORK"),
        data?.rsp_msg ?? "LS증권 API 오류",
        error.response?.data
      );
    }

    throw error;
  }
};

/**
 * LS증권 API 요청 + 연속조회 정보 포함
 */
export const lsRequestWithContinuation = async <T>(
  options: LSRequestOptions,
  retryOnTokenError: boolean = true
): Promise<{ data: T; headers: LSResponseHeaders }> => {
  const { trCode, path, body, continuation, timeout } = options;

  // TR별 호출 간격 보장
  await waitForRateLimit(trCode);

  try {
    const token = await getValidToken();

    const headers: Record<string, string> = {
      "content-type": "application/json; charset=utf-8",
      authorization: `Bearer ${token}`,
      tr_cd: trCode,
      tr_cont: continuation?.trCont || "N",
    };

    if (continuation?.trCont === "Y" && continuation?.trContKey) {
      headers["tr_cont_key"] = continuation.trContKey;
    }

    const response = await axiosInstance.post<T>(path, body, {
      headers,
      timeout: timeout ?? HTTP_CONFIG.DEFAULT_TIMEOUT,
    });

    const responseHeaders = extractResponseHeaders(
      response.headers as Record<string, unknown>
    );

    return { data: response.data, headers: responseHeaders };
  } catch (error) {
    if (retryOnTokenError && axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        logger.warn("LS token error (401), refreshing");
        await forceRefreshToken();
        return lsRequestWithContinuation<T>(options, false);
      }
    }

    // Axios 에러를 LSError로 래핑
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const data = error.response?.data as { rsp_msg?: string } | undefined;
      throw new LSError(
        String(status ?? "NETWORK"),
        data?.rsp_msg ?? "LS증권 API 오류",
        error.response?.data
      );
    }

    throw error;
  }
};

/**
 * 연속조회 API 요청 (제너레이터)
 */
export async function* lsRequestPaginated<T>(
  options: Omit<LSRequestOptions, "continuation">
): AsyncGenerator<LSPaginatedResult<T>> {
  let trCont: "Y" | "N" | null = null;
  let trContKey: string | null = null;

  do {
    const cont: LSRequestOptions["continuation"] =
      trCont === "Y" && trContKey ? { trCont: "Y", trContKey } : undefined;

    const result: { data: T; headers: LSResponseHeaders } = await lsRequestWithContinuation<T>({
      ...options,
      continuation: cont,
    });

    trCont = result.headers.trCont;
    trContKey = result.headers.trContKey;

    yield {
      data: result.data,
      hasMore: trCont === "Y",
      nextKey: trContKey ?? undefined,
    };
  } while (trCont === "Y");
}

/**
 * 연속조회 전체 데이터 수집 (배열 병합)
 */
export const lsRequestAllPages = async <
  TItem,
  TResponse extends Record<string, TItem[]>,
>(
  options: Omit<LSRequestOptions, "continuation">,
  dataKey: keyof TResponse,
  maxPages: number = 10 // 안전장치
): Promise<TItem[]> => {
  const allData: TItem[] = [];
  let pageCount = 0;

  for await (const page of lsRequestPaginated<TResponse>(options)) {
    const items = page.data[dataKey];
    if (Array.isArray(items)) {
      allData.push(...items);
    }

    pageCount++;
    if (pageCount >= maxPages) {
      logger.warn(`LS API pagination limit reached: ${maxPages} pages`);
      break;
    }
  }

  return allData;
};


import { ExternalApiError } from "../../shared/errors/AppError";

/** LS증권 API 에러. */
export class LSError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly originalResponse?: unknown
  ) {
    super(message);
    this.name = "LSError";
  }
}

/** LS증권 토큰 관련 에러. */
export class LSTokenError extends LSError {
  constructor(message: string) {
    super("TOKEN_ERROR", message);
    this.name = "LSTokenError";
  }
}

/**
 * LSError를 ExternalApiError로 변환하여 던진다.
 *
 * @remarks
 * 서비스 레이어의 catch 블록에서 사용한다.
 *
 * @throws {@link ExternalApiError} 항상 던진다
 */
export const wrapLSError = (error: unknown): never => {
  if (!(error instanceof LSError)) {
    throw error;
  }

  const code = error.code;

  const statusMap: Record<string, number> = {
    "400": 400,
    "401": 401,
    "404": 404,
    "405": 405,
    "500": 502,
    "503": 502,
    NETWORK: 502,
  };

  const status = statusMap[code] ?? 500;
  const message = ["500", "503", "NETWORK"].includes(code)
    ? "LS증권 서버 오류"
    : error.message;

  throw new ExternalApiError("LS_SECURITIES", status, message, {
    originalCode: code,
  });
};

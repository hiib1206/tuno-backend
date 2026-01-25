import { Response } from "express";
import { sendError } from "../../utils/commonResponse";

// 기본 LS증권 에러
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

// 토큰 관련 에러
export class LSTokenError extends LSError {
  constructor(message: string) {
    super("TOKEN_ERROR", message);
    this.name = "LSTokenError";
  }
}

/**
 * LS증권 에러 처리 헬퍼
 * LSError인 경우 적절한 HTTP 응답 전송
 * @returns 에러 처리 완료 여부 (true면 next() 호출 불필요)
 */
export const handleLSError = (res: Response, error: unknown): boolean => {
  if (!(error instanceof LSError)) {
    return false;
  }

  const code = error.code;

  // HTTP 상태 코드 매핑
  if (code === "400") {
    sendError(res, 400, error.message);
    return true;
  }
  if (code === "401") {
    sendError(res, 401, error.message);
    return true;
  }
  if (code === "404") {
    sendError(res, 404, error.message);
    return true;
  }
  if (code === "405") {
    sendError(res, 405, error.message);
    return true;
  }
  if (code === "500" || code === "503") {
    sendError(res, 502, "LS증권 서버 오류");
    return true;
  }
  if (code === "NETWORK") {
    sendError(res, 502, "LS증권 서버 연결 실패");
    return true;
  }

  // 기타 LSError
  sendError(res, 500, error.message);
  return true;
}

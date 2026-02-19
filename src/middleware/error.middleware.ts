import type { ErrorRequestHandler } from "express";
import { env } from "../config/env";
import logger from "../config/logger";
import { AppError } from "../shared/errors/AppError";

/**
 * 중앙 에러 처리 미들웨어.
 *
 * @remarks
 * 모든 라우트 이후에 위치해야 한다.
 * - AppError: 해당 statusCode + message + data 반환
 * - 그 외: 500 반환, 프로덕션에서는 메시지 숨김
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  // 이미 응답 전송이 시작된 경우 Express 기본 핸들러에 위임
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof AppError) {
    logger.warn(err.message, {
      statusCode: err.statusCode,
      path: req.path,
      method: req.method,
    });

    const body: Record<string, unknown> = {
      success: false,
      message: err.message,
    };

    // 프론트엔드 호환성을 위해 data 필드 유지
    if (err.data) {
      body.data = err.data;
    }

    return res.status(err.statusCode).json(body);
  }

  logger.error("Unexpected error", {
    message: err instanceof Error ? err.message : "Unknown error",
    stack: err instanceof Error ? err.stack : undefined,
    path: req.path,
    method: req.method,
  });

  return res.status(500).json({
    success: false,
    // 프로덕션: 내부 정보 노출 금지
    message:
      env.NODE_ENV === "production"
        ? "Internal server error"
        : err instanceof Error
          ? err.message
          : "Unknown error",
    // 개발 환경에서만 stack trace 포함
    ...(env.NODE_ENV !== "production" && {
      stack: err instanceof Error ? err.stack : undefined,
    }),
  });
};

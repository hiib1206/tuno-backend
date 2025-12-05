import { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { sendError } from "../utils/response";

// UUID 형식 검증 (모든 UUID 버전 지원)
const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isProduction = env.NODE_ENV === "production";

/**
 * x-device-id 헤더를 검증하는 미들웨어
 * - 헤더가 없으면: 그냥 통과 (선택적)
 * - 헤더가 있으면: UUID 형식 검증 필수 (잘못된 형식이면 에러)
 *
 * 전역 미들웨어로 사용되며, 특정 엔드포인트에서 deviceId가 필수인 경우
 * 컨트롤러에서 별도로 검증해야 합니다.
 */
export const optionalDeviceIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const deviceId = req.headers["x-device-id"] as string;

  // 헤더가 있으면 형식 검증 필수
  if (deviceId && !uuidRegex.test(deviceId)) {
    return sendError(
      res,
      400,
      isProduction
        ? "잘못된 요청입니다."
        : "x-device-id는 유효한 UUID 형식이어야 합니다."
    );
  }

  // 헤더가 없으면 그냥 통과
  next();
};

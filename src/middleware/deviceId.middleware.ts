import { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { sendError } from "../utils/response";

// UUID 형식 검증 (모든 UUID 버전 지원)
const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isProduction = env.NODE_ENV === "production";

/**
 * x-device-id 헤더를 필수로 검증하는 미들웨어
 * 프론트엔드에서 모든 요청에 x-device-id를 포함하므로,
 * 이 헤더가 없거나 형식이 맞지 않으면 요청을 거부합니다.
 */
export const requireDeviceIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const deviceId = req.headers["x-device-id"] as string;

  if (!deviceId) {
    return sendError(
      res,
      400,
      isProduction ? "잘못된 요청입니다." : "x-device-id 헤더가 필요합니다."
    );
  }

  if (!uuidRegex.test(deviceId)) {
    return sendError(
      res,
      400,
      isProduction
        ? "잘못된 요청입니다."
        : "x-device-id는 유효한 UUID 형식이어야 합니다."
    );
  }

  next();
};

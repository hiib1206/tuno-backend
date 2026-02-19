import { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { BadRequestError } from "../shared/errors/AppError";

/** 모든 UUID 버전을 허용하는 정규식 */
const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isProduction = env.NODE_ENV === "production";

/**
 * x-device-id 헤더를 선택적으로 검증하는 미들웨어.
 *
 * @remarks
 * 헤더가 없으면 통과하고, 있으면 UUID 형식을 검증한다.
 * 전역 미들웨어로 사용되며, deviceId가 필수인 엔드포인트는 컨트롤러에서 별도 검증한다.
 *
 * @throws {@link BadRequestError} x-device-id 헤더가 유효한 UUID 형식이 아닌 경우
 */
export const optionalDeviceIdMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const deviceId = req.headers["x-device-id"] as string;

  if (deviceId && !uuidRegex.test(deviceId)) {
    throw new BadRequestError(
      isProduction
        ? "잘못된 요청입니다."
        : "x-device-id는 유효한 UUID 형식이어야 합니다."
    );
  }

  next();
};

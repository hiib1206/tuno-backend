import { Request } from "express";

/**
 * 요청에서 Device ID를 추출한다.
 *
 * @remarks
 * 미들웨어에서 이미 검증되었으므로 안전하게 반환한다.
 */
export const getDeviceId = (req: Request): string => {
  return req.headers["x-device-id"] as string;
};

/** 요청에서 클라이언트 IP를 추출한다. */
export const getClientIp = (req: Request): string => {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    (req.headers["x-real-ip"] as string) ||
    req.socket.remoteAddress ||
    "unknown"
  );
};

/** 요청에서 User Agent를 추출한다. */
export const getUserAgent = (req: Request): string => {
  return req.headers["user-agent"] || "unknown";
};

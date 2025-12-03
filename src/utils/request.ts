import { Request } from "express";

// Device ID 추출 (미들웨어에서 이미 검증되었으므로 안전하게 반환)
export const getDeviceId = (req: Request): string => {
  return req.headers["x-device-id"] as string;
};

// Client IP 추출
export const getClientIp = (req: Request): string => {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    (req.headers["x-real-ip"] as string) ||
    req.socket.remoteAddress ||
    "unknown"
  );
};

// User Agent 추출
export const getUserAgent = (req: Request): string => {
  return req.headers["user-agent"] || "unknown";
};

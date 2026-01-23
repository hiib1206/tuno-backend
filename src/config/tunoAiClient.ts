import axios from "axios";
import type { Response } from "express";
import { sendError } from "../utils/commonResponse";
import { env } from "./env";

export const tunoAiClient = axios.create({
  baseURL: env.TUNO_AI_API_BASE_URL,
  timeout: 5000,
  headers: {
    "x-internal-secret-key": env.TUNO_AI_API_SECRET_KEY,
  },
});

export const handleTunoAiAxiosError = (
  res: Response,
  error: unknown
): boolean => {
  if (!axios.isAxiosError(error)) return false;

  if (error.response) {
    const { status, data } = error.response;
    const message = data?.detail || "tuno-ai 서버 오류";
    sendError(res, status, message);
    return true;
  }

  if (error.code === "ECONNABORTED") {
    sendError(res, 504, "tuno-ai 서버 타임아웃");
    return true;
  }

  sendError(res, 502, "tuno-ai 서버 연결 실패");
  return true;
};


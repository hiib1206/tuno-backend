import axios from "axios";
import { ExternalApiError } from "../shared/errors/AppError";
import { env } from "./env";

/** Tuno AI API 서버와 통신하는 axios 인스턴스. */
export const tunoAiClient = axios.create({
  baseURL: env.TUNO_AI_API_BASE_URL,
  timeout: 60000,
  headers: {
    "x-internal-secret-key": env.TUNO_AI_API_SECRET_KEY,
  },
});

/**
 * Tuno AI API 에러를 ExternalApiError로 변환하여 던진다.
 *
 * @remarks
 * 서비스 레이어의 catch 블록에서 사용한다.
 *
 * @throws {@link ExternalApiError} 항상 던진다
 */
export const wrapTunoAiError = (error: unknown): never => {
  if (!axios.isAxiosError(error)) {
    throw error;
  }

  if (error.response) {
    const { status, data } = error.response;
    const message = data?.detail || "tuno-ai 서버 오류";
    throw new ExternalApiError("TUNO_AI", status, message, data);
  }

  if (error.code === "ECONNABORTED") {
    throw new ExternalApiError("TUNO_AI", 504, "tuno-ai 서버 타임아웃");
  }

  throw new ExternalApiError("TUNO_AI", 502, "tuno-ai 서버 연결 실패");
};

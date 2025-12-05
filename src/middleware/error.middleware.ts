import { NextFunction, Request, Response } from "express";
import logger from "../config/logger";
import { sendError } from "../utils/response";

// 에러 처리 미들웨어 (모든 라우트 이후에 위치)
// sendError로 처리못해준 예상하지 못한 에러들을 단순히 500으로 응답
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logger.error("Error:", err.message);
  logger.error("Stack:", err.stack);

  sendError(res, 500, "Internal Server Error");
};

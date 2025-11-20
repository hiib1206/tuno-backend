import { Response } from "express";

// 성공 응답
export const sendSuccess = <T = any>(
  res: Response,
  statusCode: number = 200,
  message: string = "Success",
  data?: T
): Response => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

// 에러 응답
export const sendError = <T = any>(
  res: Response,
  statusCode: number = 500,
  message: string = "Internal Server Error",
  data?: T
): Response => {
  return res.status(statusCode).json({
    success: false,
    message,
    data,
  });
};

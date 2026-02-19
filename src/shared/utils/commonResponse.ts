import { Response } from "express";
import camelCase from "lodash/camelCase";

// snake_case to camelCase
const convertKeysToCamel = (data: any): any => {
  if (Array.isArray(data)) {
    return data.map(convertKeysToCamel);
  } else if (data && typeof data === "object" && data.constructor === Object) {
    return Object.fromEntries(
      Object.entries(data).map(([key, value]) => [
        camelCase(key),
        convertKeysToCamel(value),
      ])
    );
  }
  return data;
};

type SendOptions = {
  skipCamelCase?: boolean;
};

// 성공 응답
export const sendSuccess = <T = any>(
  res: Response,
  statusCode: number = 200,
  message: string = "Success",
  data?: T,
  options?: SendOptions
): Response => {
  return res.status(statusCode).json({
    success: true,
    message,
    data: options?.skipCamelCase ? data : convertKeysToCamel(data),
  });
};

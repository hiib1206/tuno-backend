import { ZodError } from "zod";

// Zod 에러 포맷팅 함수
export const formatZodError = (error: ZodError): string => {
  return error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
};

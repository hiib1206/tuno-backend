import { ZodError } from "zod";

/**
 * ZodError의 모든 이슈 메시지를 줄바꿈으로 연결하여 반환한다.
 *
 * @param error - Zod 검증 에러 객체
 * @returns 에러 메시지들을 줄바꿈으로 연결한 문자열
 */
export const formatZodError = (error: ZodError): string => {
  return error.issues.map((issue) => issue.message).join("\n");
};

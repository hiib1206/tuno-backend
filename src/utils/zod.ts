import { ZodError } from "zod";

// Zod 에러 포맷팅 함수
// 예시 출력: [email: 올바른 이메일 형식이 아닙니다.]\n[pw: 비밀번호는 최소 8자 이상이어야 합니다.]
export const formatZodError = (error: ZodError): string => {
  return error.issues
    .map((issue) => `[${issue.path.join(".")}: ${issue.message}]`)
    .join("\n");
};

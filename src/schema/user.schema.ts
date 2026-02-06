import { z } from "zod";
import { passwordSchema } from "./auth.schema";

// 비밀번호 변경
export const changePasswordSchema = z.object({
  oldPw: z.string().min(1, "현재 비밀번호를 입력해주세요."),
  newPw: passwordSchema,
});

// 마이페이지 이메일 인증 요청
export const userEmailVerificationSchema = z.object({
  email: z.string().email("올바른 이메일 형식이 아닙니다."),
});
// 타입 생성
export type UserEmailVerificationSchema = z.infer<
  typeof userEmailVerificationSchema
>;

// 마이페이지 이메일 인증 검증
export const verifyUserEmailSchema = z.object({
  code: z
    .string()
    .length(6, "인증 코드는 6자리여야 합니다.")
    .regex(/^\d+$/, "인증 코드는 숫자만 가능합니다."),
});
// 타입 생성
export type VerifyUserEmailSchema = z.infer<typeof verifyUserEmailSchema>;


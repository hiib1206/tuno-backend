import { z } from "zod";

// 비밀번호 규칙 (8자 이상 + 영문 + 숫자 + 특수문자)
export const passwordSchema = z
  .string()
  .min(8, "비밀번호는 최소 8자 이상이어야 합니다.")
  .regex(/[A-Za-z]/, "비밀번호에는 영문이 최소 1자 이상 포함되어야 합니다.")
  .regex(/\d/, "비밀번호에는 숫자가 최소 1자 이상 포함되어야 합니다.")
  .regex(
    /[^A-Za-z0-9]/,
    "비밀번호에는 특수문자가 최소 1자 이상 포함되어야 합니다."
  );

export const registerSchema = z.object({
  username: z
    .string()
    .min(4, "아이디는 최소 4자 이상이어야 합니다.")
    .max(20, "아이디는 최대 20자까지 가능합니다.")
    .regex(/^[A-Za-z0-9]+$/, "아이디는 영문 또는 영문+숫자만 가능합니다."),

  pw: passwordSchema,

  nick: z
    .string()
    .min(2, "닉네임은 최소 2자 이상이어야 합니다.")
    .max(20, "닉네임은 최대 20자까지 가능합니다."),

  email: z.string().email("올바른 이메일 형식이 아닙니다."),
  signupToken: z.string().uuid("유효하지 않은 인증 토큰입니다."),
});

export const emailVerificationSchema = z.object({
  email: z.string().email("올바른 이메일 형식이 아닙니다."),
});
// 타입 생성
export type EmailVerificationSchema = z.infer<typeof emailVerificationSchema>;

export const verifyEmailSchema = z.object({
  email: z.string().email("올바른 이메일 형식이 아닙니다."),
  code: z
    .string()
    .length(6, "인증 코드는 6자리여야 합니다.")
    .regex(/^\d+$/, "인증 코드는 숫자만 가능합니다."),
});
// 타입 생성
export type VerifyEmailSchema = z.infer<typeof verifyEmailSchema>;

// 아이디 찾기
export const findUsernameSchema = z.object({
  email: z.string().email("올바른 이메일 형식이 아닙니다."),
});
export type FindUsernameSchema = z.infer<typeof findUsernameSchema>;

// 비밀번호 재설정 요청
export const passwordResetRequestSchema = z.object({
  username: z
    .string()
    .min(4, "아이디는 최소 4자 이상이어야 합니다.")
    .max(20, "아이디는 최대 20자까지 가능합니다."),
  email: z.string().email("올바른 이메일 형식이 아닙니다."),
});
export type PasswordResetRequestSchema = z.infer<
  typeof passwordResetRequestSchema
>;

// 비밀번호 재설정
export const passwordResetSchema = z.object({
  token: z.string().uuid("유효하지 않은 토큰입니다."),
  newPw: passwordSchema,
});
export type PasswordResetSchema = z.infer<typeof passwordResetSchema>;

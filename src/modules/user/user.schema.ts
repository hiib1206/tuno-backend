import { z } from "zod";
import { passwordSchema } from "../auth/auth.schema";

export const changePasswordSchema = z.object({
  oldPw: z.string().min(1, "현재 비밀번호를 입력해주세요."),
  newPw: passwordSchema,
});

export const userEmailVerificationSchema = z.object({
  email: z.string().email("올바른 이메일 형식이 아닙니다."),
});

export type UserEmailVerificationSchema = z.infer<
  typeof userEmailVerificationSchema
>;

export const verifyUserEmailSchema = z.object({
  code: z
    .string()
    .length(6, "인증 코드는 6자리여야 합니다.")
    .regex(/^\d+$/, "인증 코드는 숫자만 가능합니다."),
});

export type VerifyUserEmailSchema = z.infer<typeof verifyUserEmailSchema>;

export const changeNicknameSchema = z.object({
  nick: z
    .string()
    .min(2, "닉네임은 최소 2자 이상이어야 합니다.")
    .max(20, "닉네임은 최대 20자까지 가능합니다."),
});

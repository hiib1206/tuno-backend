import { z } from "zod";

// 비밀번호 변경
export const changePasswordSchema = z.object({
  oldPw: z.string().min(1, "비밀번호를 입력해주세요."),
  newPw: z.string().min(1, "비밀번호를 입력해주세요."),
});

// // 이메일 인증 코드 요청
// export const requestEmailVerificationSchema = z.object({
//   email: z.string().email("올바른 이메일 형식이 아닙니다."),
// });

// // 인증 코드 확인
// export const verifyEmailCodeSchema = z.object({
//   email: z.string().email("올바른 이메일 형식이 아닙니다."),
//   code: z
//     .string()
//     .length(6, "인증 코드는 6자리여야 합니다.")
//     .regex(/^\d+$/, "인증 코드는 숫자만 가능합니다."),
// });

// // 인증 코드 재발송
// export const resendEmailVerificationSchema = z.object({
//   email: z.string().email("올바른 이메일 형식이 아닙니다."),
// });

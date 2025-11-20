import { z } from "zod";

export const registerSchema = z.object({
  username: z
    .string()
    .min(4, "아이디는 최소 4자 이상이어야 합니다.")
    .regex(/^[A-Za-z0-9]+$/, "아이디는 영문 또는 영문+숫자만 가능합니다."),

  pw: z.string().min(1, "비밀번호를 입력해주세요."),
  // 나중 추가
  // .min(8, "비밀번호는 최소 8자 이상이어야 합니다.")
  // .regex(/[A-Za-z]/, "비밀번호에는 영문이 최소 1자 이상 포함되어야 합니다.")
  // .regex(/\d/, "비밀번호에는 숫자가 최소 1자 이상 포함되어야 합니다.")
  // .regex(
  //   /[^A-Za-z0-9]/,
  //   "비밀번호에는 특수문자가 최소 1자 이상 포함되어야 합니다."
  // ),

  nick: z
    .string()
    .min(2, "닉네임은 최소 2자 이상이어야 합니다.")
    .max(20, "닉네임은 최대 20자까지 가능합니다."),
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

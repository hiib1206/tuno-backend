import { z } from "zod";
import { userResponseSchema } from "../../openapi/schemas/user.schema";

// ============================================
// 공통 필드 스키마
// ============================================

export const passwordSchema = z
  .string()
  .min(8, "비밀번호는 최소 8자 이상이어야 합니다.")
  .regex(/[A-Za-z]/, "비밀번호에는 영문이 최소 1자 이상 포함되어야 합니다.")
  .regex(/\d/, "비밀번호에는 숫자가 최소 1자 이상 포함되어야 합니다.")
  .regex(
    /[^A-Za-z0-9]/,
    "비밀번호에는 특수문자가 최소 1자 이상 포함되어야 합니다."
  )
  .openapi({
    description: "비밀번호 (영문, 숫자, 특수문자 각 1자 이상 포함, 8자 이상)",
    example: "Password123!",
  });

// ============================================
// 요청 스키마
// ============================================

/** 회원가입 요청 */
export const registerSchema = z
  .object({
    username: z
      .string()
      .min(4, "아이디는 최소 4자 이상이어야 합니다.")
      .max(20, "아이디는 최대 20자까지 가능합니다.")
      .regex(/^[A-Za-z0-9]+$/, "아이디는 영문 또는 영문+숫자만 가능합니다.")
      .openapi({
        description: "아이디 (영문 또는 영문+숫자, 4-20자)",
        example: "testuser",
      }),

    pw: passwordSchema,

    nick: z
      .string()
      .min(2, "닉네임은 최소 2자 이상이어야 합니다.")
      .max(20, "닉네임은 최대 20자까지 가능합니다.")
      .openapi({
        description: "닉네임 (2-20자)",
        example: "테스트유저",
      }),

    email: z.string().email("올바른 이메일 형식이 아닙니다.").openapi({
      description: "이메일 주소",
      example: "user@example.com",
    }),

    signupToken: z.string().uuid("유효하지 않은 인증 토큰입니다.").openapi({
      description: "이메일 인증 완료 후 발급받은 토큰",
      example: "550e8400-e29b-41d4-a716-446655440000",
    }),
  })
  .openapi("RegisterRequest");

export type RegisterSchema = z.infer<typeof registerSchema>;

/** 로그인 요청 */
export const loginSchema = z
  .object({
    username: z.string().min(1, "아이디를 입력해주세요.").openapi({
      description: "아이디",
      example: "testuser",
    }),
    pw: z.string().min(1, "비밀번호를 입력해주세요.").openapi({
      description: "비밀번호",
      example: "Password123!",
    }),
  })
  .openapi("LoginRequest");

export type LoginSchema = z.infer<typeof loginSchema>;

/** 이메일 인증 코드 발송 요청 */
export const emailVerificationSchema = z
  .object({
    email: z.string().email("올바른 이메일 형식이 아닙니다.").openapi({
      description: "인증 코드를 받을 이메일 주소",
      example: "user@example.com",
    }),
  })
  .openapi("EmailVerificationRequest");

export type EmailVerificationSchema = z.infer<typeof emailVerificationSchema>;

/** 이메일 인증 코드 확인 요청 */
export const verifyEmailSchema = z
  .object({
    email: z.string().email("올바른 이메일 형식이 아닙니다.").openapi({
      description: "인증할 이메일 주소",
      example: "user@example.com",
    }),
    code: z
      .string()
      .length(6, "인증 코드는 6자리여야 합니다.")
      .regex(/^\d+$/, "인증 코드는 숫자만 가능합니다.")
      .openapi({
        description: "6자리 인증 코드",
        example: "123456",
      }),
  })
  .openapi("VerifyEmailRequest");

export type VerifyEmailSchema = z.infer<typeof verifyEmailSchema>;

/** 아이디 찾기 요청 */
export const findUsernameSchema = z
  .object({
    email: z.string().email("올바른 이메일 형식이 아닙니다.").openapi({
      description: "가입 시 사용한 이메일 주소",
      example: "user@example.com",
    }),
  })
  .openapi("FindUsernameRequest");

export type FindUsernameSchema = z.infer<typeof findUsernameSchema>;

/** 비밀번호 재설정 요청 */
export const passwordResetRequestSchema = z
  .object({
    username: z
      .string()
      .min(4, "아이디는 최소 4자 이상이어야 합니다.")
      .max(20, "아이디는 최대 20자까지 가능합니다.")
      .openapi({
        description: "아이디",
        example: "testuser",
      }),
    email: z.string().email("올바른 이메일 형식이 아닙니다.").openapi({
      description: "가입 시 사용한 이메일 주소",
      example: "user@example.com",
    }),
  })
  .openapi("PasswordResetLinkRequest");

export type PasswordResetRequestSchema = z.infer<
  typeof passwordResetRequestSchema
>;

/** 비밀번호 재설정 */
export const passwordResetSchema = z
  .object({
    token: z.string().uuid("유효하지 않은 토큰입니다.").openapi({
      description: "비밀번호 재설정 토큰",
      example: "550e8400-e29b-41d4-a716-446655440000",
    }),
    newPw: passwordSchema,
  })
  .openapi("PasswordResetRequest");

export type PasswordResetSchema = z.infer<typeof passwordResetSchema>;

// ============================================
// 응답 스키마
// ============================================

/** 이메일 인증 완료 응답 data */
export const verifyEmailResponseDataSchema = z
  .object({
    signupToken: z.string().uuid().openapi({
      description: "회원가입에 사용할 인증 토큰",
      example: "550e8400-e29b-41d4-a716-446655440000",
    }),
  })
  .openapi("VerifyEmailResponseData");

/** 로그인 응답 data */
export const loginResponseDataSchema = z
  .object({
    accessToken: z.string().openapi({
      description: "JWT 액세스 토큰",
      example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    }),
    user: userResponseSchema,
  })
  .openapi("LoginResponseData");

/** 토큰 갱신 응답 data */
export const refreshResponseDataSchema = z
  .object({
    accessToken: z.string().openapi({
      description: "새로 발급된 JWT 액세스 토큰",
      example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    }),
  })
  .openapi("RefreshResponseData");

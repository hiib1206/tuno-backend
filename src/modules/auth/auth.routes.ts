import { Router } from "express";
import { env } from "../../config/env";
import passport from "../../config/passport";
import { verifyRefreshTokenMiddleware } from "../../middleware/auth.middleware";
import { validateMiddleware } from "../../middleware/validation.middleware";
import { registry } from "../../openapi/registry";
import {
  ErrorResponseSchema,
  SuccessResponseSchema,
  ValidationErrorResponseSchema,
  createDataResponseSchema,
} from "../../openapi/schemas/common.schema";
import {
  findUsername,
  google,
  googleCallback,
  kakao,
  kakaoCallback,
  login,
  logout,
  naver,
  naverCallback,
  refresh,
  register,
  requestPasswordReset,
  resendEmailVerification,
  resetPassword,
  sendEmailVerification,
  verifyEmail,
} from "./auth.controller";
import {
  emailVerificationSchema,
  findUsernameSchema,
  loginResponseDataSchema,
  loginSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
  refreshResponseDataSchema,
  registerSchema,
  verifyEmailResponseDataSchema,
  verifyEmailSchema,
} from "./auth.schema";

const authRouter = Router();

// ============================================
// OpenAPI 경로 등록
// ============================================

registry.registerPath({
  method: "post",
  path: "/api/auth/email/send",
  tags: ["Auth"],
  summary: "이메일 인증 코드 발송",
  description: "회원가입을 위한 이메일 인증 코드를 발송한다.",
  request: {
    body: {
      content: { "application/json": { schema: emailVerificationSchema } },
    },
  },
  responses: {
    200: {
      description: "인증 코드 발송 성공",
      content: { "application/json": { schema: SuccessResponseSchema } },
    },
    400: {
      description: "유효성 검사 실패",
      content: { "application/json": { schema: ValidationErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/auth/email/resend",
  tags: ["Auth"],
  summary: "이메일 인증 코드 재발송",
  description: "이메일 인증 코드를 재발송한다.",
  request: {
    body: {
      content: { "application/json": { schema: emailVerificationSchema } },
    },
  },
  responses: {
    200: {
      description: "인증 코드 재발송 성공",
      content: { "application/json": { schema: SuccessResponseSchema } },
    },
    400: {
      description: "유효성 검사 실패",
      content: { "application/json": { schema: ValidationErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/auth/email/verify",
  tags: ["Auth"],
  summary: "이메일 인증 코드 확인",
  description: "이메일로 발송된 인증 코드를 확인하고 회원가입 토큰을 발급한다.",
  request: {
    body: {
      content: { "application/json": { schema: verifyEmailSchema } },
    },
  },
  responses: {
    200: {
      description: "인증 성공",
      content: {
        "application/json": {
          schema: createDataResponseSchema(verifyEmailResponseDataSchema, "VerifyEmailResponse"),
        },
      },
    },
    400: {
      description: "유효성 검사 실패 또는 인증 코드 불일치",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/auth/register",
  tags: ["Auth"],
  summary: "회원가입",
  description: "이메일 인증 완료 후 회원가입을 진행한다.",
  request: {
    body: {
      content: { "application/json": { schema: registerSchema } },
    },
  },
  responses: {
    201: {
      description: "회원가입 성공",
      content: { "application/json": { schema: SuccessResponseSchema } },
    },
    400: {
      description: "유효성 검사 실패 또는 중복된 아이디/이메일",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/auth/login",
  tags: ["Auth"],
  summary: "로그인",
  description: "아이디와 비밀번호로 로그인한다. x-device-id 헤더가 필요하다.",
  request: {
    body: {
      content: { "application/json": { schema: loginSchema } },
    },
  },
  responses: {
    200: {
      description: "로그인 성공",
      content: {
        "application/json": {
          schema: createDataResponseSchema(loginResponseDataSchema, "LoginResponse"),
        },
      },
    },
    400: {
      description: "아이디/비밀번호 불일치 또는 x-device-id 헤더 누락",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/auth/refresh",
  tags: ["Auth"],
  summary: "토큰 갱신",
  description: "리프레시 토큰으로 새 액세스 토큰을 발급한다. 쿠키의 refreshToken이 필요하다.",
  responses: {
    200: {
      description: "토큰 갱신 성공",
      content: {
        "application/json": {
          schema: createDataResponseSchema(refreshResponseDataSchema, "RefreshResponse"),
        },
      },
    },
    401: {
      description: "리프레시 토큰 만료 또는 유효하지 않음",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/auth/logout",
  tags: ["Auth"],
  summary: "로그아웃",
  description: "로그아웃하고 리프레시 토큰을 무효화한다.",
  responses: {
    200: {
      description: "로그아웃 성공",
      content: { "application/json": { schema: SuccessResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/auth/find-username",
  tags: ["Auth"],
  summary: "아이디 찾기",
  description: "이메일로 아이디를 찾아 발송한다.",
  request: {
    body: {
      content: { "application/json": { schema: findUsernameSchema } },
    },
  },
  responses: {
    200: {
      description: "이메일 발송 성공",
      content: { "application/json": { schema: SuccessResponseSchema } },
    },
    400: {
      description: "유효성 검사 실패",
      content: { "application/json": { schema: ValidationErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/auth/password/reset-request",
  tags: ["Auth"],
  summary: "비밀번호 재설정 요청",
  description: "비밀번호 재설정 링크를 이메일로 발송한다.",
  request: {
    body: {
      content: { "application/json": { schema: passwordResetRequestSchema } },
    },
  },
  responses: {
    200: {
      description: "이메일 발송 성공",
      content: { "application/json": { schema: SuccessResponseSchema } },
    },
    400: {
      description: "유효성 검사 실패 또는 사용자 없음",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/auth/password/reset",
  tags: ["Auth"],
  summary: "비밀번호 재설정",
  description: "토큰을 사용해 비밀번호를 재설정한다.",
  request: {
    body: {
      content: { "application/json": { schema: passwordResetSchema } },
    },
  },
  responses: {
    200: {
      description: "비밀번호 재설정 성공",
      content: { "application/json": { schema: SuccessResponseSchema } },
    },
    400: {
      description: "유효성 검사 실패 또는 토큰 만료",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

// ============================================
// Express 라우트
// ============================================

authRouter.post(
  "/email/send",
  validateMiddleware({ body: emailVerificationSchema }),
  sendEmailVerification
);
authRouter.post(
  "/email/resend",
  validateMiddleware({ body: emailVerificationSchema }),
  resendEmailVerification
);
authRouter.post(
  "/email/verify",
  validateMiddleware({ body: verifyEmailSchema }),
  verifyEmail
);
authRouter.post(
  "/register",
  validateMiddleware({ body: registerSchema }),
  register
);
authRouter.post("/login", validateMiddleware({ body: loginSchema }), login);
authRouter.post("/refresh", verifyRefreshTokenMiddleware, refresh);
authRouter.post("/logout", logout);

authRouter.get("/google", google);
authRouter.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${env.FRONTEND_URL}/login?error=google_login_failed`,
  }),
  googleCallback
);

authRouter.get("/naver", naver);
authRouter.get(
  "/naver/callback",
  passport.authenticate("naver", {
    session: false,
    failureRedirect: `${env.FRONTEND_URL}/login?error=naver_login_failed`,
  }),
  naverCallback
);

authRouter.get("/kakao", kakao);
authRouter.get(
  "/kakao/callback",
  passport.authenticate("kakao", {
    session: false,
    failureRedirect: `${env.FRONTEND_URL}/login?error=kakao_login_failed`,
  }),
  kakaoCallback
);

authRouter.post(
  "/find-username",
  validateMiddleware({ body: findUsernameSchema }),
  findUsername
);
authRouter.post(
  "/password/reset-request",
  validateMiddleware({ body: passwordResetRequestSchema }),
  requestPasswordReset
);
authRouter.post(
  "/password/reset",
  validateMiddleware({ body: passwordResetSchema }),
  resetPassword
);

export default authRouter;

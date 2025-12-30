import { Router } from "express";
import { env } from "../config/env";
import passport from "../config/passport";
import {
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
  resendEmailVerification,
  sendEmailVerification,
  verifyEmail,
} from "../controller/auth.controller";
import { verifyRefreshTokenMiddleware } from "../middleware/auth.middleware";
import { validateMiddleware } from "../middleware/validation.middleware";
import {
  emailVerificationSchema,
  registerSchema,
  verifyEmailSchema,
} from "../schema/auth.schema";

const authRouter = Router();

// POST api/auth/email/send - 이메일 인증 코드 발송
authRouter.post(
  "/email/send",
  validateMiddleware({ body: emailVerificationSchema }),
  sendEmailVerification
);
// POST api/auth/email/resend - 이메일 인증 코드 재발송
authRouter.post(
  "/email/resend",
  validateMiddleware({ body: emailVerificationSchema }),
  resendEmailVerification
);
// POST api/auth/email/verify - 이메일 인증 검증 (signupToken 발급)
authRouter.post(
  "/email/verify",
  validateMiddleware({ body: verifyEmailSchema }),
  verifyEmail
);
// POST api/auth/register
authRouter.post(
  "/register",
  validateMiddleware({ body: registerSchema }),
  register
);
// POST api/auth/login - x-device-id 필수 (리프레시 토큰 저장)
authRouter.post("/login", login);
// POST api/auth/refresh - x-device-id 필수 (리프레시 토큰 저장)
authRouter.post("/refresh", verifyRefreshTokenMiddleware, refresh);
// POST api/auth/logout - x-device-id 불필요 (토큰에서 deviceId 추출)
authRouter.post("/logout", logout);

// GET api/auth/google - Google 로그인 시작
authRouter.get("/google", google);
// GET api/auth/google/callback - Google OAuth 콜백
// state에서 deviceId를 추출
authRouter.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${env.FRONTEND_URL}/login?error=google_login_failed`, // 실패 시 리다이렉트
  }),
  googleCallback
);

// GET api/auth/naver - Naver 로그인 시작
authRouter.get("/naver", naver);
// GET api/auth/naver/callback - Naver OAuth 콜백
authRouter.get(
  "/naver/callback",
  passport.authenticate("naver", {
    session: false,
    failureRedirect: `${env.FRONTEND_URL}/login?error=naver_login_failed`,
  }),
  naverCallback
);

// GET api/auth/kakao - Kakao 로그인 시작
authRouter.get("/kakao", kakao);
// GET api/auth/kakao/callback - Kakao OAuth 콜백
authRouter.get(
  "/kakao/callback",
  passport.authenticate("kakao", {
    session: false,
    failureRedirect: `${env.FRONTEND_URL}/login?error=kakao_login_failed`,
  }),
  kakaoCallback
);

export default authRouter;

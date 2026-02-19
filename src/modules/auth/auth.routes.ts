import { Router } from "express";
import { env } from "../../config/env";
import passport from "../../config/passport";
import { verifyRefreshTokenMiddleware } from "../../middleware/auth.middleware";
import { validateMiddleware } from "../../middleware/validation.middleware";
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
  passwordResetRequestSchema,
  passwordResetSchema,
  registerSchema,
  verifyEmailSchema,
} from "./auth.schema";

const authRouter = Router();

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
authRouter.post("/login", login);
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

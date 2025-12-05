import { Router } from "express";
import { env } from "../config/env";
import passport from "../config/passport";
import {
  google,
  googleCallback,
  login,
  logout,
  refresh,
  register,
} from "../controller/auth.controller";
import { verifyRefreshTokenMiddleware } from "../middleware/auth.middleware";
import { validateMiddleware } from "../middleware/validation.middleware";
import { registerSchema } from "../schema/auth.schema";

const authRouter = Router();

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

export default authRouter;

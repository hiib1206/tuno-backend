import { Router } from "express";
import {
  logout,
  me,
  refresh,
  register,
  requestEmailVerification,
  verifyEmailCode,
  resendEmailVerification,
} from "../controller/auth.controller";
import { login } from "../controller/auth.controller";
import { validateMiddleware } from "../middleware/validation.middleware";
import { registerSchema } from "../schema/auth.schema";
import {
  verifyAccessTokenMiddleware,
  verifyRefreshTokenMiddleware,
} from "../middleware/auth.middleware";

const authRouter = Router();

// POST api/auth/register
authRouter.post(
  "/register",
  validateMiddleware({ body: registerSchema }),
  register
);
// POST api/auth/login
authRouter.post("/login", login);
// POST api/auth/refresh
authRouter.post("/refresh", verifyRefreshTokenMiddleware, refresh);
// POST api/auth/logout
authRouter.post("/logout", logout);
// GET api/auth/me
authRouter.get("/me", verifyAccessTokenMiddleware, me);
// POST api/auth/email/request
authRouter.post(
  "/email/request",
  verifyAccessTokenMiddleware,
  requestEmailVerification
);
// POST api/auth/email/verify
authRouter.post("/email/verify", verifyAccessTokenMiddleware, verifyEmailCode);
// POST api/auth/email/resend
authRouter.post(
  "/email/resend",
  verifyAccessTokenMiddleware,
  resendEmailVerification
);

export default authRouter;

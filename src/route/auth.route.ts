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
import { validate } from "../middleware/validation.middleware";
import { registerSchema } from "../schema/auth.schema";
import {
  verifyAccessToken,
  verifyRefreshToken,
} from "../middleware/auth.middleware";

const authRouter = Router();

// POST api/auth/register
authRouter.post("/register", validate({ body: registerSchema }), register);
// POST api/auth/login
authRouter.post("/login", login);
// POST api/auth/refresh
authRouter.post("/refresh", verifyRefreshToken, refresh);
// POST api/auth/logout
authRouter.post("/logout", logout);
// GET api/auth/me
authRouter.get("/me", verifyAccessToken, me);
// POST api/auth/email/request
authRouter.post("/email/request", verifyAccessToken, requestEmailVerification);
// POST api/auth/email/verify
authRouter.post("/email/verify", verifyAccessToken, verifyEmailCode);
// POST api/auth/email/resend
authRouter.post("/email/resend", verifyAccessToken, resendEmailVerification);

export default authRouter;

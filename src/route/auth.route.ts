import { Router } from "express";
import {
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
// POST api/auth/login
authRouter.post("/login", login);
// POST api/auth/refresh
authRouter.post("/refresh", verifyRefreshTokenMiddleware, refresh);
// POST api/auth/logout
authRouter.post("/logout", logout);

export default authRouter;

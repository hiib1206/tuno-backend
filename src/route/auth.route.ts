import { Router } from "express";
import { logout, refresh, register } from "../controller/auth.controller";
import { login } from "../controller/auth.controller";
import { validate } from "../middleware/validation.middleware";
import { registerSchema } from "../schema/auth.schema";
import { verifyRefreshToken } from "../middleware/auth.middleware";

const authRouter = Router();

// POST api/auth/register
authRouter.post("/register", validate({ body: registerSchema }), register);
// POST api/auth/login
authRouter.post("/login", login);
// POST api/auth/refresh
authRouter.post("/refresh", verifyRefreshToken, refresh);
// POST api/auth/logout
authRouter.post("/logout", logout);

export default authRouter;

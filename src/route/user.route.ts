import { Router } from "express";
import {
  changeNickname,
  changePassword,
  checkNickname,
  checkUsername,
  me,
  requestEmailVerification,
  resendEmailVerification,
  uploadProfileImage,
  verifyEmailCode,
} from "../controller/user.controller";
import { verifyAccessTokenMiddleware } from "../middleware/auth.middleware";
import { uploadProfileImageMiddleware } from "../middleware/multer.middleware";
import { validateMiddleware } from "../middleware/validation.middleware";
import { changePasswordSchema } from "../schema/user.schema";

const userRouter = Router();

// GET api/user/me
userRouter.get("/me", verifyAccessTokenMiddleware, me);
// get api/user/username
userRouter.get("/username", checkUsername);
// get api/user/nickname
userRouter.get("/nickname", checkNickname);
// patch api/user/nickname
userRouter.patch("/nickname", verifyAccessTokenMiddleware, changeNickname);
// post api/user/profile-image
userRouter.post(
  "/profile-image",
  verifyAccessTokenMiddleware,
  uploadProfileImageMiddleware,
  uploadProfileImage
);
// POST api/user/email/request
userRouter.post(
  "/email/request",
  verifyAccessTokenMiddleware,
  requestEmailVerification
);
// POST api/user/email/verify
userRouter.post("/email/verify", verifyAccessTokenMiddleware, verifyEmailCode);
// POST api/user/email/resend
userRouter.post(
  "/email/resend",
  verifyAccessTokenMiddleware,
  resendEmailVerification
);
// patch api/user/password
userRouter.patch(
  "/password",
  verifyAccessTokenMiddleware,
  validateMiddleware({ body: changePasswordSchema }),
  changePassword
);

export default userRouter;

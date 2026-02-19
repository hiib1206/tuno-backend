import { Router } from "express";
import {
  changeNickname,
  changePassword,
  checkNickname,
  checkUsername,
  getUserCommunityStats,
  me,
  resendEmailVerification,
  sendEmailVerification,
  uploadProfileImage,
  verifyEmail,
  withdrawUser,
} from "./user.controller";
import { verifyAccessTokenMiddleware } from "../../middleware/auth.middleware";
import { uploadProfileImageMiddleware } from "../../middleware/multer.middleware";
import { validateMiddleware } from "../../middleware/validation.middleware";
import {
  changeNicknameSchema,
  changePasswordSchema,
  userEmailVerificationSchema,
  verifyUserEmailSchema,
} from "./user.schema";

const userRouter = Router();

userRouter.get("/me", verifyAccessTokenMiddleware, me);
userRouter.get("/username", checkUsername);
userRouter.get("/nickname", checkNickname);
userRouter.patch(
  "/nickname",
  verifyAccessTokenMiddleware,
  validateMiddleware({ body: changeNicknameSchema }),
  changeNickname
);
userRouter.post(
  "/profile-image",
  verifyAccessTokenMiddleware,
  uploadProfileImageMiddleware,
  uploadProfileImage
);
userRouter.patch(
  "/password",
  verifyAccessTokenMiddleware,
  validateMiddleware({ body: changePasswordSchema }),
  changePassword
);
userRouter.get(
  "/community/stats",
  verifyAccessTokenMiddleware,
  getUserCommunityStats
);
userRouter.post(
  "/email/send",
  verifyAccessTokenMiddleware,
  validateMiddleware({ body: userEmailVerificationSchema }),
  sendEmailVerification
);
userRouter.post(
  "/email/verify",
  verifyAccessTokenMiddleware,
  validateMiddleware({ body: verifyUserEmailSchema }),
  verifyEmail
);
userRouter.post(
  "/email/resend",
  verifyAccessTokenMiddleware,
  validateMiddleware({ body: userEmailVerificationSchema }),
  resendEmailVerification
);
userRouter.delete("/me", verifyAccessTokenMiddleware, withdrawUser);

export default userRouter;

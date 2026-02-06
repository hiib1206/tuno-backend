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
} from "../controller/user.controller";
import { verifyAccessTokenMiddleware } from "../middleware/auth.middleware";
import { uploadProfileImageMiddleware } from "../middleware/multer.middleware";
import { validateMiddleware } from "../middleware/validation.middleware";
import {
  changePasswordSchema,
  userEmailVerificationSchema,
  verifyUserEmailSchema,
} from "../schema/user.schema";

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
// patch api/user/password
userRouter.patch(
  "/password",
  verifyAccessTokenMiddleware,
  validateMiddleware({ body: changePasswordSchema }),
  changePassword
);
// GET api/user/community/stats
userRouter.get(
  "/community/stats",
  verifyAccessTokenMiddleware,
  getUserCommunityStats
);
// POST api/user/email/send - 마이페이지 이메일 인증 요청
userRouter.post(
  "/email/send",
  verifyAccessTokenMiddleware,
  validateMiddleware({ body: userEmailVerificationSchema }),
  sendEmailVerification
);
// POST api/user/email/verify - 마이페이지 이메일 인증 검증
userRouter.post(
  "/email/verify",
  verifyAccessTokenMiddleware,
  validateMiddleware({ body: verifyUserEmailSchema }),
  verifyEmail
);
// POST api/user/email/resend - 마이페이지 이메일 인증 재발송
userRouter.post(
  "/email/resend",
  verifyAccessTokenMiddleware,
  validateMiddleware({ body: userEmailVerificationSchema }),
  resendEmailVerification
);

// DELETE api/user/me - 회원탈퇴
userRouter.delete("/me", verifyAccessTokenMiddleware, withdrawUser);

export default userRouter;

import { Router } from "express";
import { me } from "../controller/auth.controller";
import { verifyAccessTokenMiddleware } from "../middleware/auth.middleware";
import {
  checkNickname,
  checkUsername,
  updateUser,
  uploadProfileImage,
} from "../controller/user.controller";
import { uploadProfileImageMiddleware } from "../middleware/multer.middleware";

const userRouter = Router();

// patch api/user
userRouter.patch("/", verifyAccessTokenMiddleware, updateUser);
// get api/user/check-username
userRouter.get("/check-username", checkUsername);
// get api/user/check-nickname
userRouter.get("/check-nickname", checkNickname);
// patch api/user/profile-image
userRouter.post(
  "/profile-image",
  verifyAccessTokenMiddleware,
  uploadProfileImageMiddleware,
  uploadProfileImage
);

export default userRouter;

import { Router } from "express";
import { me } from "../controller/auth.controller";
import { verifyAccessToken } from "../middleware/auth.middleware";
import {
  checkNickname,
  checkUsername,
  updateUser,
} from "../controller/user.controller";

const userRouter = Router();

// patch api/user
userRouter.patch("/", verifyAccessToken, updateUser);
// get api/user/check-username
userRouter.get("/check-username", checkUsername);
// get api/user/check-nickname
userRouter.get("/check-nickname", checkNickname);

export default userRouter;

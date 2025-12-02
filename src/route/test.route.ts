import { Router } from "express";
import {
  testAccessToken,
  testFileUpload,
  testRedis,
  testResponse,
} from "../controller/test.controller";
import { verifyAccessTokenMiddleware } from "../middleware/auth.middleware";
import { uploadProfileImageMiddleware } from "../middleware/multer.middleware";

const testRouter = Router();

// GET api/test/important
testRouter.get("/important", verifyAccessTokenMiddleware, testAccessToken);
// GET api/test/response
testRouter.get("/response", testResponse);
// POST api/test/upload
testRouter.post("/upload", uploadProfileImageMiddleware, testFileUpload);
// POST api/test/redis
testRouter.post("/redis", testRedis);

export default testRouter;

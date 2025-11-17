import { Router } from "express";
import { testAccessToken, testResponse } from "../controller/test.controller";
import { verifyAccessToken } from "../middleware/auth.middleware";

const testRouter = Router();

// GET api/test/important
testRouter.get("/important", verifyAccessToken, testAccessToken);
// GET api/test/response
testRouter.get("/response", testResponse);

export default testRouter;

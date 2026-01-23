import { Router } from "express";
import { postSnapbackInference } from "../controller/inference.controller";
import { validateMiddleware } from "../middleware/validation.middleware";
import { snapbackInferenceBodySchema } from "../schema/inference.schema";

const inferenceRouter = Router();

// POST /api/inference/snapback
inferenceRouter.post(
  "/snapback",
  validateMiddleware({ body: snapbackInferenceBodySchema }),
  postSnapbackInference
);

export default inferenceRouter;


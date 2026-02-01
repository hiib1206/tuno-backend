import { Router } from "express";
import {
  getInferenceHistory,
  getInferenceHistoryById,
  postQuantSignalInference,
  postSnapbackInference,
} from "../controller/inference.controller";
import { verifyAccessTokenMiddleware } from "../middleware/auth.middleware";
import { validateMiddleware } from "../middleware/validation.middleware";
import {
  getInferenceHistoryByIdParamsSchema,
  getInferenceHistoryQuerySchema,
  quantSignalInferenceBodySchema,
  snapbackInferenceBodySchema,
} from "../schema/inference.schema";

const inferenceRouter = Router();

// GET /api/inference/history - 유저의 AI 추론 이력 조회
inferenceRouter.get(
  "/history",
  verifyAccessTokenMiddleware,
  validateMiddleware({ query: getInferenceHistoryQuerySchema }),
  getInferenceHistory
);

// GET /api/inference/history/:id - 유저의 AI 추론 이력 단건 조회
inferenceRouter.get(
  "/history/:id",
  verifyAccessTokenMiddleware,
  validateMiddleware({ params: getInferenceHistoryByIdParamsSchema }),
  getInferenceHistoryById
);

// POST /api/inference/snapback
inferenceRouter.post(
  "/snapback",
  verifyAccessTokenMiddleware,
  validateMiddleware({ body: snapbackInferenceBodySchema }),
  postSnapbackInference
);

// POST /api/inference/quant-signal
inferenceRouter.post(
  "/quant-signal",
  verifyAccessTokenMiddleware,
  validateMiddleware({ body: quantSignalInferenceBodySchema }),
  postQuantSignalInference
);

export default inferenceRouter;


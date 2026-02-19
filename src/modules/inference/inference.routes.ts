import { Router } from "express";
import {
  deleteInferenceHistory,
  getInferenceHistory,
  getInferenceHistoryById,
  getQuotaInfo,
  postQuantSignalInference,
  postSnapbackInference,
} from "./inference.controller";
import { verifyAccessTokenMiddleware } from "../../middleware/auth.middleware";
import {
  checkAndIncrementQuota,
  checkInferenceQuota,
} from "../../middleware/quota.middleware";
import { validateMiddleware } from "../../middleware/validation.middleware";
import {
  getInferenceHistoryByIdParamsSchema,
  getInferenceHistoryQuerySchema,
  quantSignalInferenceBodySchema,
  snapbackInferenceBodySchema,
} from "./inference.schema";

const inferenceRouter = Router();

inferenceRouter.get("/quota", verifyAccessTokenMiddleware, getQuotaInfo);

inferenceRouter.get(
  "/history",
  verifyAccessTokenMiddleware,
  validateMiddleware({ query: getInferenceHistoryQuerySchema }),
  getInferenceHistory
);

inferenceRouter.get(
  "/history/:id",
  verifyAccessTokenMiddleware,
  validateMiddleware({ params: getInferenceHistoryByIdParamsSchema }),
  getInferenceHistoryById
);

inferenceRouter.delete(
  "/history/:id",
  verifyAccessTokenMiddleware,
  validateMiddleware({ params: getInferenceHistoryByIdParamsSchema }),
  deleteInferenceHistory
);

inferenceRouter.post(
  "/snapback",
  verifyAccessTokenMiddleware,
  validateMiddleware({ body: snapbackInferenceBodySchema }),
  checkInferenceQuota,
  postSnapbackInference
);

inferenceRouter.post(
  "/quant-signal",
  verifyAccessTokenMiddleware,
  validateMiddleware({ body: quantSignalInferenceBodySchema }),
  checkAndIncrementQuota,
  postQuantSignalInference
);

export default inferenceRouter;

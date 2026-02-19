import { Router } from "express";
import { verifyAccessTokenMiddleware } from "../../middleware/auth.middleware";
import { validateMiddleware } from "../../middleware/validation.middleware";
import {
  createStockComment,
  deleteMyStockComments,
  deleteStockComment,
  getStockCommentList,
  updateStockComment,
} from "./stock-comment.controller";
import {
  createStockCommentBodySchema,
  deleteMyStockCommentsQuerySchema,
  getStockCommentListParamsSchema,
  getStockCommentListQuerySchema,
  stockCommentIdParamsSchema,
  updateStockCommentBodySchema,
} from "./stock-comment.schema";

const stockCommentRouter = Router();

stockCommentRouter.get(
  "/:ticker",
  validateMiddleware({
    params: getStockCommentListParamsSchema,
    query: getStockCommentListQuerySchema,
  }),
  getStockCommentList
);

stockCommentRouter.post(
  "/",
  verifyAccessTokenMiddleware,
  validateMiddleware({ body: createStockCommentBodySchema }),
  createStockComment
);

stockCommentRouter.patch(
  "/:id",
  verifyAccessTokenMiddleware,
  validateMiddleware({
    params: stockCommentIdParamsSchema,
    body: updateStockCommentBodySchema,
  }),
  updateStockComment
);

stockCommentRouter.delete(
  "/",
  verifyAccessTokenMiddleware,
  validateMiddleware({ query: deleteMyStockCommentsQuerySchema }),
  deleteMyStockComments
);

stockCommentRouter.delete(
  "/:id",
  verifyAccessTokenMiddleware,
  validateMiddleware({ params: stockCommentIdParamsSchema }),
  deleteStockComment
);

export default stockCommentRouter;

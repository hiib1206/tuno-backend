import { Router } from "express";
import {
  createStockComment,
  deleteMyStockComments,
  deleteStockComment,
  getStockCommentList,
  updateStockComment,
} from "../controller/stock-comment.controller";
import { verifyAccessTokenMiddleware } from "../middleware/auth.middleware";
import { validateMiddleware } from "../middleware/validation.middleware";
import {
  createStockCommentBodySchema,
  deleteMyStockCommentsQuerySchema,
  getStockCommentListParamsSchema,
  getStockCommentListQuerySchema,
  stockCommentIdParamsSchema,
  updateStockCommentBodySchema,
} from "../schema/stock-comment.schema";

const stockCommentRouter = Router();

// GET /api/stock-comment/:ticker - 종목별 댓글 목록 조회
stockCommentRouter.get(
  "/:ticker",
  validateMiddleware({
    params: getStockCommentListParamsSchema,
    query: getStockCommentListQuerySchema,
  }),
  getStockCommentList
);

// POST /api/stock-comment - 종목 댓글 작성
stockCommentRouter.post(
  "/",
  verifyAccessTokenMiddleware,
  validateMiddleware({ body: createStockCommentBodySchema }),
  createStockComment
);

// PATCH /api/stock-comment/:id - 종목 댓글 수정
stockCommentRouter.patch(
  "/:id",
  verifyAccessTokenMiddleware,
  validateMiddleware({
    params: stockCommentIdParamsSchema,
    body: updateStockCommentBodySchema,
  }),
  updateStockComment
);

// DELETE /api/stock-comment - 본인 종목 댓글 일괄 삭제 (/:id 보다 위에 배치)
stockCommentRouter.delete(
  "/",
  verifyAccessTokenMiddleware,
  validateMiddleware({ query: deleteMyStockCommentsQuerySchema }),
  deleteMyStockComments
);

// DELETE /api/stock-comment/:id - 종목 댓글 삭제
stockCommentRouter.delete(
  "/:id",
  verifyAccessTokenMiddleware,
  validateMiddleware({ params: stockCommentIdParamsSchema }),
  deleteStockComment
);

export default stockCommentRouter;

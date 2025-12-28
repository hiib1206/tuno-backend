import { Router } from "express";
import {
  deleteComment,
  deleteComments,
  getMyCommentList,
  updateComment,
} from "../controller/post-comment.controller";
import { verifyAccessTokenMiddleware } from "../middleware/auth.middleware";
import { validateMiddleware } from "../middleware/validation.middleware";
import {
  deleteCommentsSchema,
  getMyCommentListSchema,
  getPostCommentSchema,
  updatePostCommentSchema,
} from "../schema/post-comment.schema";

const postCommentRouter = Router();

// GET api/comment/me (나의 댓글 목록 조회 - /:id 보다 위에 배치하여 경로 충돌 방지)
postCommentRouter.get(
  "/me",
  verifyAccessTokenMiddleware, // 인증 필수
  validateMiddleware({ query: getMyCommentListSchema }),
  getMyCommentList
);

// DELETE api/comment (여러 댓글 삭제 - /:id 라우트보다 위에 배치하여 경로 충돌 방지)
postCommentRouter.delete(
  "/",
  verifyAccessTokenMiddleware,
  validateMiddleware({ body: deleteCommentsSchema }),
  deleteComments
);

// PATCH api/comment/:id
postCommentRouter.patch(
  "/:id",
  verifyAccessTokenMiddleware,
  validateMiddleware({
    params: getPostCommentSchema,
    body: updatePostCommentSchema,
  }),
  updateComment
);

// DELETE api/comment/:id
postCommentRouter.delete(
  "/:id",
  verifyAccessTokenMiddleware,
  validateMiddleware({
    params: getPostCommentSchema,
  }),
  deleteComment
);

export default postCommentRouter;

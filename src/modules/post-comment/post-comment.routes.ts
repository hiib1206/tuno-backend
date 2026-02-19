import { Router } from "express";
import { verifyAccessTokenMiddleware } from "../../middleware/auth.middleware";
import { validateMiddleware } from "../../middleware/validation.middleware";
import {
  deleteComment,
  deleteComments,
  getMyCommentList,
  updateComment,
} from "./post-comment.controller";
import {
  deleteCommentsSchema,
  getMyCommentListSchema,
  getPostCommentSchema,
  updatePostCommentSchema,
} from "./post-comment.schema";

const postCommentRouter = Router();

postCommentRouter.get(
  "/me",
  verifyAccessTokenMiddleware,
  validateMiddleware({ query: getMyCommentListSchema }),
  getMyCommentList
);

postCommentRouter.delete(
  "/",
  verifyAccessTokenMiddleware,
  validateMiddleware({ body: deleteCommentsSchema }),
  deleteComments
);

postCommentRouter.patch(
  "/:id",
  verifyAccessTokenMiddleware,
  validateMiddleware({
    params: getPostCommentSchema,
    body: updatePostCommentSchema,
  }),
  updateComment
);

postCommentRouter.delete(
  "/:id",
  verifyAccessTokenMiddleware,
  validateMiddleware({
    params: getPostCommentSchema,
  }),
  deleteComment
);

export default postCommentRouter;

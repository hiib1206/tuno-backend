import { Router } from "express";
import {
  createPostComment,
  getPostCommentList,
} from "../post-comment/post-comment.controller";
import {
  createPost,
  deletePost,
  deletePosts,
  getMyLikedPostList,
  getMyPostList,
  getPost,
  getPostList,
  togglePostLike,
  togglePostLikes,
  updatePost,
} from "./post.controller";
import {
  optionalVerifyAccessTokenMiddleware,
  verifyAccessTokenMiddleware,
} from "../../middleware/auth.middleware";
import { uploadPostImageMiddleware } from "../../middleware/multer.middleware";
import { validateMiddleware } from "../../middleware/validation.middleware";
import {
  createPostCommentSchema,
  getPostCommentListSchema,
} from "../post-comment/post-comment.schema";
import {
  createPostSchema,
  deletePostSchema,
  deletePostsSchema,
  getPostListSchema,
  getPostSchema,
  togglePostLikesSchema,
  updatePostSchema,
} from "./post.schema";

const postRouter = Router();

postRouter.get(
  "/",
  optionalVerifyAccessTokenMiddleware,
  validateMiddleware({ query: getPostListSchema }),
  getPostList
);

postRouter.get(
  "/me/liked",
  verifyAccessTokenMiddleware,
  validateMiddleware({ query: getPostListSchema }),
  getMyLikedPostList
);

postRouter.get(
  "/me",
  verifyAccessTokenMiddleware,
  validateMiddleware({ query: getPostListSchema }),
  getMyPostList
);

postRouter.get(
  "/:id",
  optionalVerifyAccessTokenMiddleware,
  validateMiddleware({ params: getPostSchema }),
  getPost
);

postRouter.post(
  "/",
  verifyAccessTokenMiddleware,
  uploadPostImageMiddleware,
  validateMiddleware({ body: createPostSchema }),
  createPost
);

postRouter.patch(
  "/:id",
  verifyAccessTokenMiddleware,
  uploadPostImageMiddleware,
  validateMiddleware({
    params: getPostSchema,
    body: updatePostSchema,
  }),
  updatePost
);

postRouter.delete(
  "/",
  verifyAccessTokenMiddleware,
  validateMiddleware({ body: deletePostsSchema }),
  deletePosts
);

postRouter.delete(
  "/:id",
  verifyAccessTokenMiddleware,
  validateMiddleware({ params: deletePostSchema }),
  deletePost
);

postRouter.get(
  "/:id/comment",
  validateMiddleware({
    params: getPostSchema,
    query: getPostCommentListSchema,
  }),
  getPostCommentList
);

postRouter.post(
  "/:id/comment",
  verifyAccessTokenMiddleware,
  validateMiddleware({
    params: getPostSchema,
    body: createPostCommentSchema,
  }),
  createPostComment
);

postRouter.post(
  "/likes",
  verifyAccessTokenMiddleware,
  validateMiddleware({ body: togglePostLikesSchema }),
  togglePostLikes
);

postRouter.post(
  "/:id/like",
  verifyAccessTokenMiddleware,
  validateMiddleware({ params: getPostSchema }),
  togglePostLike
);

export default postRouter;

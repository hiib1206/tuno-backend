import { Router } from "express";
import {
  createPostComment,
  getPostCommentList,
} from "../controller/post-comment.controller";
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
} from "../controller/post.controller";
import {
  optionalVerifyAccessTokenMiddleware,
  verifyAccessTokenMiddleware,
} from "../middleware/auth.middleware";
import { uploadPostImageMiddleware } from "../middleware/multer.middleware";
import { validateMiddleware } from "../middleware/validation.middleware";
import {
  createPostCommentSchema,
  getPostCommentListSchema,
} from "../schema/post-comment.schema";
import {
  createPostSchema,
  deletePostSchema,
  deletePostsSchema,
  getPostListSchema,
  getPostSchema,
  togglePostLikesSchema,
  updatePostSchema,
} from "../schema/post.schema";

const postRouter = Router();

// GET api/post (목록 조회 - /:id 라우트보다 위에 배치하여 경로 충돌 방지)
postRouter.get(
  "/",
  optionalVerifyAccessTokenMiddleware,
  validateMiddleware({ query: getPostListSchema }),
  getPostList
);

// GET api/post/me/liked (내가 좋아요한 게시글 목록 조회 - /me 보다 위에 배치하여 경로 충돌 방지)
postRouter.get(
  "/me/liked",
  verifyAccessTokenMiddleware, // 인증 필수
  validateMiddleware({ query: getPostListSchema }),
  getMyLikedPostList
);

// GET api/post/me (내 게시글 목록 조회 - /:id 보다 위에 배치하여 경로 충돌 방지)
postRouter.get(
  "/me",
  verifyAccessTokenMiddleware, // 인증 필수
  validateMiddleware({ query: getPostListSchema }),
  getMyPostList
);

// GET api/post/:id
postRouter.get(
  "/:id",
  optionalVerifyAccessTokenMiddleware, // 선택적 인증 미들웨어 추가
  validateMiddleware({ params: getPostSchema }),
  getPost
);

// POST api/post
postRouter.post(
  "/",
  verifyAccessTokenMiddleware,
  uploadPostImageMiddleware, // FormData 파싱 및 이미지 파일 처리
  validateMiddleware({ body: createPostSchema }),
  createPost
);

// PATCH api/post/:id
postRouter.patch(
  "/:id",
  verifyAccessTokenMiddleware,
  uploadPostImageMiddleware, // FormData 파싱 및 이미지 파일 처리
  validateMiddleware({
    params: getPostSchema,
    body: updatePostSchema,
  }),
  updatePost
);

// DELETE api/post (여러 게시글 삭제 - /:id 라우트보다 위에 배치하여 경로 충돌 방지)
postRouter.delete(
  "/",
  verifyAccessTokenMiddleware,
  validateMiddleware({ body: deletePostsSchema }),
  deletePosts
);

// DELETE api/post/:id
postRouter.delete(
  "/:id",
  verifyAccessTokenMiddleware,
  validateMiddleware({ params: deletePostSchema }),
  deletePost
);

// GET api/post/:id/comment (POST 라우트보다 위에 배치하여 경로 충돌 방지)
postRouter.get(
  "/:id/comment",
  validateMiddleware({
    params: getPostSchema,
    query: getPostCommentListSchema,
  }),
  getPostCommentList
);

// POST api/post/:id/comment
postRouter.post(
  "/:id/comment",
  verifyAccessTokenMiddleware,
  validateMiddleware({
    params: getPostSchema,
    body: createPostCommentSchema,
  }),
  createPostComment
);

// POST api/post/likes (여러 게시글 좋아요 일괄 취소 - /:id/like 라우트보다 위에 배치하여 경로 충돌 방지)
postRouter.post(
  "/likes",
  verifyAccessTokenMiddleware,
  validateMiddleware({ body: togglePostLikesSchema }),
  togglePostLikes
);

// POST api/post/:id/like
postRouter.post(
  "/:id/like",
  verifyAccessTokenMiddleware,
  validateMiddleware({ params: getPostSchema }),
  togglePostLike
);

export default postRouter;

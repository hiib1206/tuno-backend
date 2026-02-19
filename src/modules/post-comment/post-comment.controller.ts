import { Request, Response } from "express";
import { sendSuccess } from "../../shared/utils/commonResponse";
import { UserPayload } from "../../shared/utils/token";
import {
  CreatePostCommentSchema,
  DeleteCommentsSchema,
  GetMyCommentListSchema,
  GetPostCommentListSchema,
  UpdatePostCommentSchema,
} from "./post-comment.schema";
import {
  createPostCommentService,
  deleteCommentService,
  deleteCommentsService,
  getMyCommentListService,
  getPostCommentListService,
  updateCommentService,
} from "./post-comment.service";

/** 댓글을 생성한다. */
export const createPostComment = async (req: Request, res: Response) => {
  const { userId } = req.user as UserPayload;
  const postId = BigInt(req.params.id);
  const { content, parent_id } = req.body as CreatePostCommentSchema;

  const result = await createPostCommentService(userId, postId, content, parent_id);

  return sendSuccess(res, 201, "댓글이 생성되었습니다.", result.data);
};

/** 댓글 목록을 조회한다. */
export const getPostCommentList = async (req: Request, res: Response) => {
  const postId = BigInt(req.params.id);
  const { page, limit, order } = req.validated?.query as GetPostCommentListSchema;

  const result = await getPostCommentListService(postId, page, limit, order);

  return sendSuccess(res, 200, "댓글 목록을 조회했습니다.", result.data);
};

/** 나의 댓글 목록을 조회한다. */
export const getMyCommentList = async (req: Request, res: Response) => {
  const { userId } = req.user as UserPayload;
  const { page, limit, order } = req.validated?.query as GetMyCommentListSchema;

  const result = await getMyCommentListService(userId, page, limit, order);

  return sendSuccess(res, 200, "내 댓글 목록을 조회했습니다.", result.data);
};

/** 댓글을 수정한다. */
export const updateComment = async (req: Request, res: Response) => {
  const { userId } = req.user as UserPayload;
  const commentId = BigInt(req.params.id);
  const { content } = req.body as UpdatePostCommentSchema;

  const result = await updateCommentService(userId, commentId, content);

  return sendSuccess(res, 200, "댓글이 수정되었습니다.", result.data);
};

/** 여러 댓글을 삭제한다. */
export const deleteComments = async (req: Request, res: Response) => {
  const { userId } = req.user as UserPayload;
  const { ids } = req.validated?.body as DeleteCommentsSchema;

  const result = await deleteCommentsService(userId, ids);

  return sendSuccess(res, 200, "댓글 삭제가 완료되었습니다.", result.data);
};

/** 댓글을 삭제한다. */
export const deleteComment = async (req: Request, res: Response) => {
  const { userId } = req.user as UserPayload;
  const commentId = BigInt(req.params.id);

  await deleteCommentService(userId, commentId);

  return sendSuccess(res, 200, "댓글이 삭제되었습니다.");
};

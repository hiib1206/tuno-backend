import { Request, Response } from "express";
import { sendSuccess } from "../../shared/utils/commonResponse";
import { getClientIp } from "../../shared/utils/request";
import { UserPayload } from "../../shared/utils/token";
import {
  DeletePostsSchema,
  GetPostListSchema,
  TogglePostLikesSchema,
} from "./post.schema";
import {
  createPostService,
  deletePostService,
  deletePostsService,
  getMyLikedPostListService,
  getPostListService,
  getPostService,
  togglePostLikeService,
  togglePostLikesService,
  updatePostService,
} from "./post.service";
import { FileData } from "./post.utils";

/** 게시글 목록을 조회한다. */
export const getPostList = async (req: Request, res: Response) => {
  const queryParams = req.validated?.query as GetPostListSchema;
  const currentUserId = (req.user as UserPayload | undefined)?.userId;

  const result = await getPostListService({
    ...queryParams,
    currentUserId,
  });

  return sendSuccess(res, 200, "게시글 목록을 조회했습니다.", result);
};

/** 내 게시글 목록을 조회한다. */
export const getMyPostList = async (req: Request, res: Response) => {
  const { userId } = req.user as UserPayload;
  const queryParams = req.validated?.query as GetPostListSchema;

  const result = await getPostListService({
    ...queryParams,
    authorId: userId,
    currentUserId: userId,
  });

  return sendSuccess(res, 200, "내 게시글 목록을 조회했습니다.", result);
};

/** 게시글을 단건 조회한다. */
export const getPost = async (req: Request, res: Response) => {
  const postId = BigInt(req.params.id);
  const currentUserId = (req.user as UserPayload)?.userId ?? undefined;
  const clientIp = getClientIp(req);

  const result = await getPostService(postId, currentUserId, clientIp);

  return sendSuccess(res, 200, "게시글을 조회했습니다.", result.data);
};

/** 게시글을 저장한다. */
export const createPost = async (req: Request, res: Response) => {
  const { userId } = req.user as UserPayload;
  const { title, content, category, blobUrlMapping } = req.body;
  const files = req.files as Express.Multer.File[];

  const fileData: FileData[] = files.map((f) => ({
    buffer: f.buffer,
    mimetype: f.mimetype,
    originalname: f.originalname,
  }));

  const result = await createPostService({
    userId,
    title,
    content,
    category,
    blobUrlMapping,
    files: fileData,
  });

  return sendSuccess(res, 201, "게시글이 저장되었습니다.", result.data);
};

/** 게시글을 수정한다. */
export const updatePost = async (req: Request, res: Response) => {
  const { userId } = req.user as UserPayload;
  const postId = BigInt(req.params.id);
  const { title, content, category, blobUrlMapping } = req.body;
  const files = req.files as Express.Multer.File[];

  const fileData: FileData[] = files.map((f) => ({
    buffer: f.buffer,
    mimetype: f.mimetype,
    originalname: f.originalname,
  }));

  const result = await updatePostService({
    userId,
    postId,
    title,
    content,
    category,
    blobUrlMapping,
    files: fileData,
  });

  return sendSuccess(res, 200, "게시글이 수정되었습니다.", result.data);
};

/** 게시글을 삭제한다. */
export const deletePost = async (req: Request, res: Response) => {
  const { userId } = req.user as UserPayload;
  const postId = BigInt(req.params.id);

  await deletePostService(userId, postId);

  return sendSuccess(res, 200, "게시글이 삭제되었습니다.");
};

/** 여러 게시글을 삭제한다. */
export const deletePosts = async (req: Request, res: Response) => {
  const { userId } = req.user as UserPayload;
  const { ids } = req.validated?.body as DeletePostsSchema;

  const result = await deletePostsService(userId, ids);

  return sendSuccess(res, 200, "게시글 삭제가 완료되었습니다.", result.data);
};

/** 게시글 좋아요를 토글한다. */
export const togglePostLike = async (req: Request, res: Response) => {
  const { userId } = req.user as UserPayload;
  const postId = BigInt(req.params.id);

  const result = await togglePostLikeService(userId, postId);

  return sendSuccess(
    res,
    200,
    result.data!.isLiked
      ? "좋아요가 추가되었습니다."
      : "좋아요가 취소되었습니다.",
    result.data
  );
};

/** 여러 게시글 좋아요를 일괄 취소한다. */
export const togglePostLikes = async (req: Request, res: Response) => {
  const { userId } = req.user as UserPayload;
  const { ids } = req.validated?.body as TogglePostLikesSchema;

  const result = await togglePostLikesService(userId, ids);

  return sendSuccess(res, 200, "좋아요 취소가 완료되었습니다.", result.data);
};

/** 내가 좋아요한 게시글 목록을 조회한다. */
export const getMyLikedPostList = async (req: Request, res: Response) => {
  const { userId } = req.user as UserPayload;
  const { page, limit, order } = req.validated?.query as GetPostListSchema;

  const result = await getMyLikedPostListService(userId, page, limit, order);

  return sendSuccess(
    res,
    200,
    result.data!.list.length > 0
      ? "좋아요한 게시글 목록을 조회했습니다."
      : "좋아요한 게시글이 없습니다.",
    result.data
  );
};

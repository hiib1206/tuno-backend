import { postModel } from "../../generated/prisma/models/post";
import { userModel } from "../../generated/prisma/models/user";
import { toUserResponse } from "../user/user.utils";

/**
 * Post 객체를 응답용으로 변환한다.
 *
 * @remarks
 * BigInt인 id를 string으로 변환하고, author를 toUserResponse로 변환한다.
 *
 * @param post - 변환할 Post 객체
 * @param viewCount - 증가된 조회수 (조회수 증가 후 호출 시 사용)
 * @param isLiked - 로그인한 사용자의 좋아요 여부
 */
export const toPostResponse = (
  post: postModel & { author?: userModel },
  viewCount?: number,
  isLiked?: boolean
) => {
  return {
    id: post.id.toString(),
    title: post.title,
    content: post.content,
    category: post.category,
    view_count: viewCount !== undefined ? viewCount : post.view_count,
    comment_count: post.comment_count,
    like_count: post.like_count,
    isLiked: isLiked !== undefined ? isLiked : undefined,
    is_pinned: post.is_pinned,
    created_at: post.created_at,
    updated_at: post.updated_at,
    author: post.author ? toUserResponse(post.author) : undefined,
  };
};

/** Multer 파일에서 추출한 파일 데이터. */
export interface FileData {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

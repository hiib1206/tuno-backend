import { postModel } from "../generated/prisma/models/post";
import { userModel } from "../generated/prisma/models/user";
import { toUserResponse } from "./user";

/**
 * Post 객체를 응답용으로 변환
 * - id를 string으로 변환 (BigInt 처리)
 * - author를 toUserResponse로 변환
 * - view_count는 증가된 값을 받아서 사용 (조회수 증가 후 호출)
 * - like_count는 항상 포함
 * - isLiked는 로그인한 사용자의 좋아요 여부 (선택적)
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

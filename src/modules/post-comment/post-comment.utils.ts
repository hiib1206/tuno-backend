import { post_commentModel } from "../../generated/prisma/models/post_comment";
import { toPublicUrl } from "../../shared/utils/firebase";

/**
 * PostComment 객체를 응답용으로 변환
 * - id, post_id, parent_id를 string으로 변환 (BigInt 처리)
 * - author를 toUserResponse로 변환
 */
export const toPostCommentResponse = (
  comment: post_commentModel & {
    author?: {
      id: number;
      username: string | null;
      nick: string;
      profile_image_url: string | null;
    };
  }
) => {
  return {
    id: comment.id.toString(),
    post_id: comment.post_id.toString(),
    content: comment.deleted_at ? "삭제된 댓글입니다" : comment.content,
    parent_id: comment.parent_id?.toString() || null,
    created_at: comment.created_at,
    updated_at: comment.updated_at,
    deleted_at: comment.deleted_at || null,
    author:
      comment.author && !comment.deleted_at
        ? {
            id: comment.author.id.toString(),
            username: comment.author.username,
            nick: comment.author.nick,
            profile_image_url: toPublicUrl(comment.author.profile_image_url),
          }
        : null,
  };
};

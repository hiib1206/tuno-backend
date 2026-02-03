import { NextFunction, Request, Response } from "express";
import prisma from "../config/prisma";
import {
  CreatePostCommentSchema,
  DeleteCommentsSchema,
  GetMyCommentListSchema,
  GetPostCommentListSchema,
  UpdatePostCommentSchema,
} from "../schema/post-comment.schema";
import { sendToUser } from "../service/sse.service";
import { sendError, sendSuccess } from "../utils/commonResponse";
import { CommentNotificationData, ReplyNotificationData } from "../types/notification";
import { notification_type, SSEEvent, toNotificationResponse } from "../utils/notification";
import { toPostCommentResponse } from "../utils/post-comment";
import { UserPayload } from "../utils/token";

/**
 * 댓글 생성
 * POST /api/post/:id/comment
 */
export const createPostComment = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.user as UserPayload;
    const postId = BigInt(req.params.id);
    const { content, parent_id } = req.body as CreatePostCommentSchema;

    // 게시글 존재 여부 확인
    const post = await prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      return sendError(res, 404, "게시글을 찾을 수 없습니다.");
    }

    if (post.deleted_at) {
      return sendError(
        res,
        400,
        "삭제된 게시글에는 댓글을 작성할 수 없습니다."
      );
    }

    // 대댓글인 경우 부모 댓글 존재 여부 확인
    let parentComment: { id: bigint; author_id: number; parent_id: bigint | null; post_id: bigint; deleted_at: Date | null } | null = null;
    if (parent_id) {
      parentComment = await prisma.post_comment.findUnique({
        where: { id: parent_id },
        select: { id: true, author_id: true, parent_id: true, post_id: true, deleted_at: true },
      });

      if (!parentComment) {
        return sendError(res, 404, "부모 댓글을 찾을 수 없습니다.");
      }

      if (parentComment.deleted_at) {
        return sendError(
          res,
          400,
          "삭제된 댓글에는 대댓글을 작성할 수 없습니다."
        );
      }

      // 부모 댓글 검증 섹션에 추가
      if (parentComment.parent_id !== null) {
        return sendError(res, 400, "답글에는 답글을 작성할 수 없습니다.");
      }

      // 부모 댓글이 같은 게시글에 속하는지 확인
      if (parentComment.post_id !== postId) {
        return sendError(
          res,
          400,
          "부모 댓글이 해당 게시글에 속하지 않습니다."
        );
      }
    }

    // 댓글 생성 및 게시글 comment_count 증가 (트랜잭션)
    const comment = await prisma.$transaction(async (tx) => {
      // 1. 댓글 생성
      const newComment = await tx.post_comment.create({
        data: {
          post_id: postId,
          content,
          author_id: userId,
          parent_id: parent_id || null,
        },
        include: {
          author: {
            select: {
              id: true,
              username: true,
              nick: true,
              profile_image_url: true,
            },
          },
        },
      });

      // 2. 게시글 comment_count 증가 (모든 댓글에 대해 +1)
      await tx.post.update({
        where: { id: postId },
        data: {
          comment_count: {
            increment: 1,
          },
        },
      });

      return newComment;
    });

    // 알림 생성 (트랜잭션 바깥 - 실패해도 댓글은 저장됨)
    try {
      if (parentComment) {
        // 대댓글인 경우: 부모 댓글 작성자에게 알림 (본인 제외)
        if (parentComment.author_id !== userId) {
          const notificationData: ReplyNotificationData = {
            postId: postId.toString(),
            commentId: parentComment.id.toString(),
            replyId: comment.id.toString(),
            preview: content.slice(0, 50),
          };

          const notification = await prisma.notification.create({
            data: {
              user_id: parentComment.author_id,
              actor_id: userId,
              type: notification_type.REPLY,
              data: notificationData,
            },
            include: {
              actor: {
                select: { id: true, username: true, nick: true, profile_image_url: true },
              },
            },
          });

          // SSE로 실시간 알림
          sendToUser(
            parentComment.author_id.toString(),
            SSEEvent.NOTIFICATION_CREATED,
            toNotificationResponse(notification),
          );
        }
      } else {
        // 일반 댓글인 경우: 글 작성자에게 알림 (본인 제외)
        if (post.author_id !== userId) {
          const notificationData: CommentNotificationData = {
            postId: postId.toString(),
            commentId: comment.id.toString(),
            preview: content.slice(0, 50),
          };

          const notification = await prisma.notification.create({
            data: {
              user_id: post.author_id,
              actor_id: userId,
              type: notification_type.COMMENT,
              data: notificationData,
            },
            include: {
              actor: {
                select: { id: true, username: true, nick: true, profile_image_url: true },
              },
            },
          });

          // SSE로 실시간 알림
          sendToUser(
            post.author_id.toString(),
            SSEEvent.NOTIFICATION_CREATED,
            toNotificationResponse(notification),
          );
        }
      }
    } catch (notificationError) {
      // 알림 생성 실패해도 댓글은 이미 저장됨 - 로그만 남김
      console.error("알림 생성 실패:", notificationError);
    }

    return sendSuccess(res, 201, "댓글이 생성되었습니다.", {
      comment: toPostCommentResponse(comment),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 댓글 목록 조회
 * GET /api/post/:id/comment
 */
export const getPostCommentList = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const postId = BigInt(req.params.id);
    const { page, limit, order } = req.validated
      ?.query as GetPostCommentListSchema;

    // 게시글 존재 여부 확인
    const post = await prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      return sendError(res, 404, "게시글을 찾을 수 없습니다.");
    }

    const offset = (page - 1) * limit;

    // 1. 최상위 댓글(parent_id가 null) 조회 (페이징 적용)
    const [topLevelComments, totalCount] = await Promise.all([
      prisma.post_comment.findMany({
        where: {
          post_id: postId,
          parent_id: null,
        },
        include: {
          author: {
            select: {
              id: true,
              username: true,
              nick: true,
              profile_image_url: true,
            },
          },
        },
        orderBy: {
          created_at: order,
        },
        skip: offset,
        take: limit,
      }),
      prisma.post_comment.count({
        where: {
          post_id: postId,
          parent_id: null,
        },
      }),
    ]);

    // 2. 최상위 댓글 ID 목록 추출
    const topLevelCommentIds = topLevelComments.map((comment) => comment.id);

    // 3. 해당 ID들을 parent_id로 가진 대댓글 조회
    let replies: (typeof topLevelComments)[0][] = [];
    if (topLevelCommentIds.length > 0) {
      replies = await prisma.post_comment.findMany({
        where: {
          post_id: postId,
          parent_id: {
            in: topLevelCommentIds,
          },
        },
        include: {
          author: {
            select: {
              id: true,
              username: true,
              nick: true,
              profile_image_url: true,
            },
          },
        },
        orderBy: {
          created_at: "asc",
        },
      });
    }
    // 4. Map을 사용하여 각 최상위 댓글에 replies 배열 추가
    const repliesMap = new Map<string, (typeof replies)[0][]>();

    replies.forEach((reply) => {
      const parentId = reply.parent_id!.toString();
      if (!repliesMap.has(parentId)) {
        repliesMap.set(parentId, []);
      }
      repliesMap.get(parentId)!.push(reply);
    });

    // 5. 트리 구조 생성 및 toPostCommentResponse로 변환
    const commentsWithReplies = topLevelComments.map((comment) => {
      const commentResponse = toPostCommentResponse(comment);
      const commentReplies =
        repliesMap.get(comment.id.toString())?.map(toPostCommentResponse) || [];

      return {
        ...commentResponse,
        replies: commentReplies,
      };
    });

    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return sendSuccess(res, 200, "댓글 목록을 조회했습니다.", {
      list: commentsWithReplies,
      page,
      limit,
      total: totalCount,
      totalPages,
      hasNextPage,
      hasPrevPage,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 나의 댓글 목록 조회
 * GET /api/comment/me
 */
export const getMyCommentList = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.user as UserPayload;
    const { page, limit, sort, order } = req.validated
      ?.query as GetMyCommentListSchema;

    const offset = (page - 1) * limit;

    // 정렬 필드 보안 처리 (created_at만 사용)
    const sortOrder = order.toLowerCase() === "asc" ? "asc" : "desc";

    // 나의 댓글 조회 (삭제되지 않은 것만)
    const [comments, totalCount] = await Promise.all([
      prisma.post_comment.findMany({
        where: {
          author_id: userId,
          deleted_at: null,
        },
        include: {
          post: {
            select: {
              id: true,
              title: true,
              category: true,
              deleted_at: true,
            },
          },
        },
        orderBy: { created_at: sortOrder },
        skip: offset,
        take: limit,
      }),
      prisma.post_comment.count({
        where: {
          author_id: userId,
          deleted_at: null,
        },
      }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return sendSuccess(res, 200, "내 댓글 목록을 조회했습니다.", {
      comments: comments.map((comment) => ({
        ...toPostCommentResponse(comment),
        post: comment.post.deleted_at
          ? null
          : {
              id: comment.post.id.toString(),
              title: comment.post.title,
              category: comment.post.category,
            },
      })),
      totalCount,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 댓글 수정
 * PATCH /api/comment/:id
 */
export const updateComment = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.user as UserPayload;
    const commentId = BigInt(req.params.id);
    const { content } = req.body as UpdatePostCommentSchema;

    // 댓글 조회
    const existingComment = await prisma.post_comment.findUnique({
      where: { id: commentId },
      include: {
        author: {
          select: {
            id: true,
          },
        },
      },
    });

    // 댓글이 존재하지 않는 경우
    if (!existingComment) {
      return sendError(res, 404, "댓글을 찾을 수 없습니다.");
    }

    // 이미 삭제된 댓글인 경우
    if (existingComment.deleted_at) {
      return sendError(res, 400, "이미 삭제된 댓글입니다.");
    }

    // 작성자 확인
    if (existingComment.author_id !== userId) {
      return sendError(res, 403, "댓글을 수정할 권한이 없습니다.");
    }

    // content가 제공되지 않은 경우
    if (content === undefined) {
      return sendError(res, 400, "수정할 내용을 입력해주세요.");
    }

    // 댓글 업데이트
    const updatedComment = await prisma.post_comment.update({
      where: { id: commentId },
      data: {
        content,
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            nick: true,
            profile_image_url: true,
          },
        },
      },
    });

    return sendSuccess(res, 200, "댓글이 수정되었습니다.", {
      comment: toPostCommentResponse(updatedComment),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 여러 댓글 삭제
 * DELETE /api/comment
 */
export const deleteComments = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.user as UserPayload;
    const { ids } = req.validated?.body as DeleteCommentsSchema;

    const success: Array<{ id: string; message: string }> = [];
    const failed: Array<{ id: string; message: string }> = [];

    // 1. BigInt 변환
    const commentIds = ids.map((idStr) => BigInt(idStr));

    // 2. 한 번에 모든 댓글 조회
    const comments = await prisma.post_comment.findMany({
      where: {
        id: { in: commentIds },
      },
      select: {
        id: true,
        author_id: true,
        deleted_at: true,
        post_id: true,
      },
    });

    // 3. 조회된 댓글을 Map으로 변환 (빠른 검색)
    const commentMap = new Map(comments.map((c) => [c.id.toString(), c]));

    // 4. 삭제 가능한 댓글 ID 수집 및 실패 케이스 처리
    const deletableIds: bigint[] = [];

    for (const idStr of ids) {
      const comment = commentMap.get(idStr);

      // 댓글이 존재하지 않는 경우
      if (!comment) {
        failed.push({
          id: idStr,
          message: "댓글을 찾을 수 없습니다.",
        });
        continue;
      }

      // 이미 삭제된 댓글인 경우
      if (comment.deleted_at) {
        failed.push({
          id: idStr,
          message: "이미 삭제된 댓글입니다.",
        });
        continue;
      }

      // 작성자 확인
      if (comment.author_id !== userId) {
        failed.push({
          id: idStr,
          message: "댓글을 삭제할 권한이 없습니다.",
        });
        continue;
      }

      // 삭제 가능
      deletableIds.push(BigInt(idStr));
    }

    // 5. 한 번에 일괄 삭제 (updateMany 사용)
    if (deletableIds.length > 0) {
      await prisma.post_comment.updateMany({
        where: {
          id: { in: deletableIds },
        },
        data: {
          deleted_at: new Date(),
        },
      });

      // 성공 목록 생성
      for (const id of deletableIds) {
        success.push({
          id: id.toString(),
          message: "댓글이 삭제되었습니다.",
        });
      }
    }

    return sendSuccess(res, 200, "댓글 삭제가 완료되었습니다.", {
      success,
      failed,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 댓글 삭제
 * DELETE /api/comment/:id
 */
export const deleteComment = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.user as UserPayload;
    const commentId = BigInt(req.params.id);

    // 댓글 조회
    const existingComment = await prisma.post_comment.findUnique({
      where: { id: commentId },
      include: {
        author: {
          select: {
            id: true,
          },
        },
      },
    });

    // 댓글이 존재하지 않는 경우
    if (!existingComment) {
      return sendError(res, 404, "댓글을 찾을 수 없습니다.");
    }

    // 이미 삭제된 댓글인 경우
    if (existingComment.deleted_at) {
      return sendError(res, 400, "이미 삭제된 댓글입니다.");
    }

    // 작성자 확인
    if (existingComment.author_id !== userId) {
      return sendError(res, 403, "댓글을 삭제할 권한이 없습니다.");
    }

    // 게시글 존재 여부 확인
    const post = await prisma.post.findUnique({
      where: { id: existingComment.post_id },
    });

    if (!post) {
      return sendError(res, 404, "게시글을 찾을 수 없습니다.");
    }

    // 댓글 soft delete (deleted_at 설정)
    await prisma.post_comment.update({
      where: { id: commentId },
      data: { deleted_at: new Date() },
    });

    return sendSuccess(res, 200, "댓글이 삭제되었습니다.");
  } catch (error) {
    next(error);
  }
};

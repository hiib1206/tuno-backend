import logger from "../../config/logger";
import prisma from "../../config/prisma";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from "../../shared/errors/AppError";
import { sendToUser } from "../../shared/utils/sse-manager";
import { CommentNotificationData, ReplyNotificationData } from "../notification/notification.types";
import { notification_type, SSEEvent, toNotificationResponse } from "../notification/notification.utils";
import { toPostCommentResponse } from "./post-comment.utils";

/** 작성자 select 공통 옵션. */
const authorSelect = {
  id: true,
  username: true,
  nick: true,
  profile_image_url: true,
};

/** 댓글을 생성한다. */
export const createPostCommentService = async (
  userId: number,
  postId: bigint,
  content: string,
  parentId?: bigint
) => {
  const post = await prisma.post.findUnique({
    where: { id: postId },
  });

  if (!post) {
    throw new NotFoundError("게시글을 찾을 수 없습니다.");
  }

  if (post.deleted_at) {
    throw new BadRequestError("삭제된 게시글에는 댓글을 작성할 수 없습니다.");
  }

  let parentComment: {
    id: bigint;
    author_id: number;
    parent_id: bigint | null;
    post_id: bigint;
    deleted_at: Date | null;
  } | null = null;

  if (parentId) {
    parentComment = await prisma.post_comment.findUnique({
      where: { id: parentId },
      select: { id: true, author_id: true, parent_id: true, post_id: true, deleted_at: true },
    });

    if (!parentComment) {
      throw new NotFoundError("부모 댓글을 찾을 수 없습니다.");
    }

    if (parentComment.deleted_at) {
      throw new BadRequestError("삭제된 댓글에는 대댓글을 작성할 수 없습니다.");
    }

    if (parentComment.parent_id !== null) {
      throw new BadRequestError("답글에는 답글을 작성할 수 없습니다.");
    }

    if (parentComment.post_id !== postId) {
      throw new BadRequestError("부모 댓글이 해당 게시글에 속하지 않습니다.");
    }
  }

  const comment = await prisma.$transaction(async (tx) => {
    const newComment = await tx.post_comment.create({
      data: {
        post_id: postId,
        content,
        author_id: userId,
        parent_id: parentId || null,
      },
      include: {
        author: {
          select: authorSelect,
        },
      },
    });

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

  // 알림 생성은 트랜잭션 바깥에서 실행해 실패해도 댓글은 유지됨
  try {
    if (parentComment) {
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
              select: authorSelect,
            },
          },
        });

        sendToUser(
          parentComment.author_id.toString(),
          SSEEvent.NOTIFICATION_CREATED,
          toNotificationResponse(notification)
        );
      }
    } else {
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
              select: authorSelect,
            },
          },
        });

        sendToUser(
          post.author_id.toString(),
          SSEEvent.NOTIFICATION_CREATED,
          toNotificationResponse(notification)
        );
      }
    }
  } catch (notificationError) {
    logger.error("알림 생성 실패", { error: notificationError });
  }

  return { data: { comment: toPostCommentResponse(comment) } };
};

/** 댓글 목록을 트리 구조로 조회한다. */
export const getPostCommentListService = async (
  postId: bigint,
  page: number,
  limit: number,
  order: "asc" | "desc"
) => {
  const post = await prisma.post.findUnique({
    where: { id: postId },
  });

  if (!post) {
    throw new NotFoundError("게시글을 찾을 수 없습니다.");
  }

  const offset = (page - 1) * limit;
  const [topLevelComments, totalCount] = await Promise.all([
    prisma.post_comment.findMany({
      where: {
        post_id: postId,
        parent_id: null,
      },
      include: {
        author: {
          select: authorSelect,
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

  const topLevelCommentIds = topLevelComments.map((comment) => comment.id);

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
          select: authorSelect,
        },
      },
      orderBy: {
        created_at: "asc",
      },
    });
  }

  const repliesMap = new Map<string, (typeof replies)[0][]>();

  replies.forEach((reply) => {
    const parentId = reply.parent_id!.toString();
    if (!repliesMap.has(parentId)) {
      repliesMap.set(parentId, []);
    }
    repliesMap.get(parentId)!.push(reply);
  });

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

  return {
    data: {
      list: commentsWithReplies,
      page,
      limit,
      total: totalCount,
      totalPages,
      hasNextPage,
      hasPrevPage,
    },
  };
};

/** 나의 댓글 목록을 조회한다. */
export const getMyCommentListService = async (
  userId: number,
  page: number,
  limit: number,
  order: "asc" | "desc"
) => {
  const offset = (page - 1) * limit;

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
      orderBy: { created_at: order },
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

  return {
    data: {
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
    },
  };
};

/** 댓글을 수정한다. */
export const updateCommentService = async (
  userId: number,
  commentId: bigint,
  content?: string
) => {
  const existingComment = await prisma.post_comment.findUnique({
    where: { id: commentId },
    include: {
      author: {
        select: { id: true },
      },
    },
  });

  if (!existingComment) {
    throw new NotFoundError("댓글을 찾을 수 없습니다.");
  }

  if (existingComment.deleted_at) {
    throw new BadRequestError("이미 삭제된 댓글입니다.");
  }

  if (existingComment.author_id !== userId) {
    throw new ForbiddenError("댓글을 수정할 권한이 없습니다.");
  }

  if (content === undefined) {
    throw new BadRequestError("수정할 내용을 입력해주세요.");
  }

  const updatedComment = await prisma.post_comment.update({
    where: { id: commentId },
    data: { content },
    include: {
      author: {
        select: authorSelect,
      },
    },
  });

  return { data: { comment: toPostCommentResponse(updatedComment) } };
};

/** 여러 댓글을 삭제한다. */
export const deleteCommentsService = async (userId: number, ids: string[]) => {
  const success: Array<{ id: string; message: string }> = [];
  const failed: Array<{ id: string; message: string }> = [];

  const commentIds = ids.map((idStr) => BigInt(idStr));

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

  const commentMap = new Map(comments.map((c) => [c.id.toString(), c]));

  const deletableIds: bigint[] = [];

  for (const idStr of ids) {
    const comment = commentMap.get(idStr);

    if (!comment) {
      failed.push({ id: idStr, message: "댓글을 찾을 수 없습니다." });
      continue;
    }

    if (comment.deleted_at) {
      failed.push({ id: idStr, message: "이미 삭제된 댓글입니다." });
      continue;
    }

    if (comment.author_id !== userId) {
      failed.push({ id: idStr, message: "댓글을 삭제할 권한이 없습니다." });
      continue;
    }

    deletableIds.push(BigInt(idStr));
  }

  if (deletableIds.length > 0) {
    await prisma.post_comment.updateMany({
      where: {
        id: { in: deletableIds },
      },
      data: {
        deleted_at: new Date(),
      },
    });

    for (const id of deletableIds) {
      success.push({ id: id.toString(), message: "댓글이 삭제되었습니다." });
    }
  }

  return { data: { success, failed } };
};

/** 단일 댓글을 삭제한다. */
export const deleteCommentService = async (userId: number, commentId: bigint) => {
  const existingComment = await prisma.post_comment.findUnique({
    where: { id: commentId },
    include: {
      author: {
        select: { id: true },
      },
    },
  });

  if (!existingComment) {
    throw new NotFoundError("댓글을 찾을 수 없습니다.");
  }

  if (existingComment.deleted_at) {
    throw new BadRequestError("이미 삭제된 댓글입니다.");
  }

  if (existingComment.author_id !== userId) {
    throw new ForbiddenError("댓글을 삭제할 권한이 없습니다.");
  }

  const post = await prisma.post.findUnique({
    where: { id: existingComment.post_id },
  });

  if (!post) {
    throw new NotFoundError("게시글을 찾을 수 없습니다.");
  }

  await prisma.post_comment.update({
    where: { id: commentId },
    data: { deleted_at: new Date() },
  });

  return { data: null };
};

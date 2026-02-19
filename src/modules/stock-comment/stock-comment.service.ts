import prisma from "../../config/prisma";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from "../../shared/errors/AppError";
import { toPublicUrl } from "../../shared/utils/firebase";
import {
  CreateStockCommentBodySchema,
  GetStockCommentListQuerySchema,
  StockCommentAuthor,
  StockCommentItem,
  UpdateStockCommentBodySchema,
} from "./stock-comment.schema";

/** author 정보를 응답용으로 변환한다. */
const toAuthorResponse = (author: {
  id: number;
  nick: string;
  profile_image_url: string | null;
}): StockCommentAuthor => ({
  id: author.id,
  nick: author.nick,
  profileImageUrl: toPublicUrl(author.profile_image_url),
});

/** 종목 댓글 목록을 조회한다. */
export const getStockCommentListService = async (
  ticker: string,
  params: GetStockCommentListQuerySchema
): Promise<{ list: StockCommentItem[]; limit: number }> => {
  const { limit, order, opinion } = params;

  const where = {
    ticker,
    deleted_at: null,
    ...(opinion && { opinion }),
  };

  const comments = await prisma.stock_comment.findMany({
    where,
    include: {
      author: {
        select: {
          id: true,
          nick: true,
          profile_image_url: true,
        },
      },
    },
    orderBy: { created_at: order },
    take: limit,
  });

  return {
    list: comments.map((c) => ({
      id: c.id.toString(),
      ticker: c.ticker,
      exchange: c.exchange,
      content: c.content,
      opinion: c.opinion,
      author: toAuthorResponse(c.author),
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    })),
    limit,
  };
};

/** 종목 댓글을 생성한다. */
export const createStockCommentService = async (
  userId: number,
  body: CreateStockCommentBodySchema
): Promise<StockCommentItem> => {
  const { ticker, exchange, content, opinion } = body;

  const comment = await prisma.stock_comment.create({
    data: {
      ticker,
      exchange,
      content,
      opinion,
      author_id: userId,
    },
    include: {
      author: {
        select: {
          id: true,
          nick: true,
          profile_image_url: true,
        },
      },
    },
  });

  return {
    id: comment.id.toString(),
    ticker: comment.ticker,
    exchange: comment.exchange,
    content: comment.content,
    opinion: comment.opinion,
    author: toAuthorResponse(comment.author),
    createdAt: comment.created_at,
    updatedAt: comment.updated_at,
  };
};

/** 종목 댓글을 수정한다. */
export const updateStockCommentService = async (
  userId: number,
  commentId: string,
  body: UpdateStockCommentBodySchema
): Promise<StockCommentItem> => {
  const { content, opinion } = body;

  const existing = await prisma.stock_comment.findFirst({
    where: { id: BigInt(commentId), deleted_at: null },
  });

  if (!existing) {
    throw new NotFoundError("종목 댓글을 찾을 수 없습니다.");
  }

  if (existing.author_id !== userId) {
    throw new ForbiddenError("댓글을 수정할 권한이 없습니다.");
  }

  if (content === undefined && opinion === undefined) {
    throw new BadRequestError("수정할 내용을 입력해 주세요.");
  }

  const updated = await prisma.stock_comment.update({
    where: { id: existing.id },
    data: {
      ...(content !== undefined && { content }),
      ...(opinion !== undefined && { opinion }),
    },
    include: {
      author: {
        select: {
          id: true,
          nick: true,
          profile_image_url: true,
        },
      },
    },
  });

  return {
    id: updated.id.toString(),
    ticker: updated.ticker,
    exchange: updated.exchange,
    content: updated.content,
    opinion: updated.opinion,
    author: toAuthorResponse(updated.author),
    createdAt: updated.created_at,
    updatedAt: updated.updated_at,
  };
};

/** 종목 댓글을 삭제한다. */
export const deleteStockCommentService = async (
  userId: number,
  commentId: string
): Promise<void> => {
  const existing = await prisma.stock_comment.findFirst({
    where: { id: BigInt(commentId), deleted_at: null },
  });

  if (!existing) {
    throw new NotFoundError("종목 댓글을 찾을 수 없습니다.");
  }

  if (existing.author_id !== userId) {
    throw new ForbiddenError("댓글을 삭제할 권한이 없습니다.");
  }

  await prisma.stock_comment.update({
    where: { id: existing.id },
    data: { deleted_at: new Date() },
  });
};

/** 본인 종목 댓글을 일괄 삭제한다. */
export const deleteMyStockCommentsService = async (
  userId: number,
  ticker?: string
): Promise<{ deletedCount: number }> => {
  const result = await prisma.stock_comment.updateMany({
    where: {
      author_id: userId,
      deleted_at: null,
      ...(ticker && { ticker }),
    },
    data: { deleted_at: new Date() },
  });

  return { deletedCount: result.count };
};

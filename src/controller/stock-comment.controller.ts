import { NextFunction, Request, Response } from "express";
import prisma from "../config/prisma";
import {
  CreateStockCommentBodySchema,
  DeleteMyStockCommentsQuerySchema,
  GetStockCommentListParamsSchema,
  GetStockCommentListQuerySchema,
  StockCommentIdParamsSchema,
  UpdateStockCommentBodySchema,
} from "../schema/stock-comment.schema";
import { sendError, sendSuccess } from "../utils/commonResponse";
import { toPublicUrl } from "../utils/firebase";
import { UserPayload } from "../utils/token";

const toAuthorResponse = (author: {
  id: number;
  nick: string;
  profile_image_url: string | null;
}) => ({
  id: author.id,
  nick: author.nick,
  profile_image_url: toPublicUrl(author.profile_image_url),
});

/**
 * 종목 댓글 목록 조회
 * GET /api/stock-comment/:ticker
 */
export const getStockCommentList = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { ticker } =
      req.validated?.params as GetStockCommentListParamsSchema;
    const { limit, order, opinion } =
      req.validated?.query as GetStockCommentListQuerySchema;

    const where = {
      ticker,
      deleted_at: null,
      ...(opinion && { opinion }),
    };

    // 현재는 최근 limit개만 반환 (페이지네이션 비활성)
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

    return sendSuccess(res, 200, "종목 댓글 목록을 조회했습니다.", {
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
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 종목 댓글 작성
 * POST /api/stock-comment
 */
export const createStockComment = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.user as UserPayload;
    const { ticker, exchange, content, opinion } =
      req.validated?.body as CreateStockCommentBodySchema;

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

    return sendSuccess(res, 201, "종목 댓글이 생성되었습니다.", {
      id: comment.id.toString(),
      ticker: comment.ticker,
      exchange: comment.exchange,
      content: comment.content,
      opinion: comment.opinion,
      author: toAuthorResponse(comment.author),
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 종목 댓글 수정
 * PATCH /api/stock-comment/:id
 */
export const updateStockComment = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.user as UserPayload;
    const { id } = req.validated?.params as StockCommentIdParamsSchema;
    const { content, opinion } =
      req.validated?.body as UpdateStockCommentBodySchema;

    const existing = await prisma.stock_comment.findFirst({
      where: { id: BigInt(id), deleted_at: null },
    });

    if (!existing) {
      return sendError(res, 404, "종목 댓글을 찾을 수 없습니다.");
    }

    if (existing.author_id !== userId) {
      return sendError(res, 403, "댓글을 수정할 권한이 없습니다.");
    }

    if (content === undefined && opinion === undefined) {
      return sendError(res, 400, "수정할 내용을 입력해 주세요.");
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

    return sendSuccess(res, 200, "종목 댓글이 수정되었습니다.", {
      id: updated.id.toString(),
      ticker: updated.ticker,
      exchange: updated.exchange,
      content: updated.content,
      opinion: updated.opinion,
      author: toAuthorResponse(updated.author),
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 종목 댓글 삭제
 * DELETE /api/stock-comment/:id
 */
export const deleteStockComment = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.user as UserPayload;
    const { id } = req.validated?.params as StockCommentIdParamsSchema;

    const existing = await prisma.stock_comment.findFirst({
      where: { id: BigInt(id), deleted_at: null },
    });

    if (!existing) {
      return sendError(res, 404, "종목 댓글을 찾을 수 없습니다.");
    }

    if (existing.author_id !== userId) {
      return sendError(res, 403, "댓글을 삭제할 권한이 없습니다.");
    }

    await prisma.stock_comment.update({
      where: { id: existing.id },
      data: { deleted_at: new Date() },
    });

    return sendSuccess(res, 200, "종목 댓글이 삭제되었습니다.");
  } catch (error) {
    next(error);
  }
};

/**
 * 본인 종목 댓글 일괄 삭제
 * DELETE /api/stock-comment
 */
export const deleteMyStockComments = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.user as UserPayload;
    const { ticker } =
      req.validated?.query as DeleteMyStockCommentsQuerySchema;

    const result = await prisma.stock_comment.updateMany({
      where: {
        author_id: userId,
        deleted_at: null,
        ...(ticker && { ticker }),
      },
      data: { deleted_at: new Date() },
    });

    return sendSuccess(res, 200, "종목 댓글이 삭제되었습니다.", {
      deletedCount: result.count,
    });
  } catch (error) {
    next(error);
  }
};

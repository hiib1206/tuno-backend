import { z } from "zod";
import { stock_opinion } from "../../generated/prisma/enums";

// ── 요청 스키마 ──

// 종목 댓글 목록 조회 - path params
export const getStockCommentListParamsSchema = z.object({
  ticker: z
    .string()
    .min(1, "종목코드를 입력해 주세요.")
    .max(9, "종목코드는 최대 9자리입니다."),
});

export type GetStockCommentListParamsSchema = z.infer<
  typeof getStockCommentListParamsSchema
>;

// 종목 댓글 목록 조회 - query params
export const getStockCommentListQuerySchema = z.object({
  page: z
    .preprocess((val) => {
      if (val === undefined || val === null || val === "") return 1;
      if (typeof val === "string") return parseInt(val, 10);
      if (typeof val === "number") return val;
      return 1;
    }, z.number().int().min(1).default(1))
    .default(1),

  limit: z
    .preprocess((val) => {
      if (val === undefined || val === null || val === "") return 100;
      if (typeof val === "string") return parseInt(val, 10);
      if (typeof val === "number") return val;
      return 100;
    }, z.number().int().min(1).max(100).default(100))
    .default(100),

  order: z.enum(["asc", "desc"]).default("desc"),

  opinion: z
    .enum(Object.values(stock_opinion) as [stock_opinion, ...stock_opinion[]])
    .optional(),
});

export type GetStockCommentListQuerySchema = z.infer<
  typeof getStockCommentListQuerySchema
>;

// 종목 댓글 생성
export const createStockCommentBodySchema = z.object({
  ticker: z
    .string()
    .min(1, "종목코드를 입력해 주세요.")
    .max(9, "종목코드는 최대 9자리입니다."),
  exchange: z
    .string()
    .min(1, "거래소 코드를 입력해 주세요.")
    .max(4, "거래소 코드는 최대 4자리입니다."),
  content: z
    .string()
    .min(1, "댓글 내용을 입력해 주세요.")
    .max(1000, "댓글은 최대 1000자까지 가능합니다."),
  opinion: z.enum(
    Object.values(stock_opinion) as [stock_opinion, ...stock_opinion[]]
  ),
});

export type CreateStockCommentBodySchema = z.infer<
  typeof createStockCommentBodySchema
>;

// 종목 댓글 ID params
export const stockCommentIdParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, "id는 숫자여야 합니다."),
});

export type StockCommentIdParamsSchema = z.infer<
  typeof stockCommentIdParamsSchema
>;

// 종목 댓글 수정
export const updateStockCommentBodySchema = z.object({
  content: z
    .string()
    .min(1, "댓글 내용을 입력해 주세요.")
    .max(1000, "댓글은 최대 1000자까지 가능합니다.")
    .optional(),
  opinion: z
    .enum(
      Object.values(stock_opinion) as [stock_opinion, ...stock_opinion[]]
    )
    .optional(),
});

export type UpdateStockCommentBodySchema = z.infer<
  typeof updateStockCommentBodySchema
>;

// 본인 종목 댓글 일괄 삭제 - query params (ticker 선택)
export const deleteMyStockCommentsQuerySchema = z.object({
  ticker: z
    .string()
    .min(1)
    .max(9)
    .optional(),
});

export type DeleteMyStockCommentsQuerySchema = z.infer<
  typeof deleteMyStockCommentsQuerySchema
>;

// ── 응답 타입 ──

export type StockCommentAuthor = {
  id: number;
  nick: string;
  profileImageUrl: string | null;
};

export type StockCommentItem = {
  id: string;
  ticker: string;
  exchange: string;
  content: string;
  opinion: stock_opinion;
  author: StockCommentAuthor;
  createdAt: Date;
  updatedAt: Date;
};

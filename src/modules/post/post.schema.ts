import { z } from "zod";
import { post_category } from "../../generated/prisma/client";
import { toPostResponse } from "./post.utils";

/** 게시글 저장 요청 스키마. */
export const createPostSchema = z.object({
  title: z
    .string()
    .min(1, "제목을 입력해주세요.")
    .max(255, "제목은 최대 255자까지 가능합니다."),

  category: z.enum(post_category, {
    message: "존재하지 않는 카테고리 입니다.",
  }),

  content: z.string().min(1, "내용을 입력해주세요."),

  blobUrlMapping: z
    .union([z.string(), z.record(z.string(), z.number())])
    .optional()
    .transform((val) => {
      if (!val) return {};
      if (typeof val === "string") {
        try {
          return JSON.parse(val);
        } catch {
          return {};
        }
      }
      return val;
    })
    .default({}),
});

/** 게시글 ID 파라미터 스키마. */
export const getPostSchema = z.object({
  id: z
    .string()
    .min(1, "게시글 ID를 입력해주세요.")
    .regex(/^\d+$/, "게시글 ID는 숫자여야 합니다."),
});

/** 게시글 삭제 파라미터 스키마. */
export const deletePostSchema = z.object({
  id: z
    .string()
    .min(1, "게시글 ID를 입력해주세요.")
    .regex(/^\d+$/, "게시글 ID는 숫자여야 합니다."),
});

/** 여러 게시글 삭제 요청 스키마. */
export const deletePostsSchema = z.object({
  ids: z
    .array(z.string().regex(/^\d+$/, "게시글 ID는 숫자여야 합니다."))
    .min(1, "최소 1개 이상의 게시글 ID를 입력해주세요."),
});
export type DeletePostsSchema = z.infer<typeof deletePostsSchema>;

/** 여러 게시글 좋아요 토글 요청 스키마. */
export const togglePostLikesSchema = z.object({
  ids: z
    .array(z.string().regex(/^\d+$/, "게시글 ID는 숫자여야 합니다."))
    .min(1, "최소 1개 이상의 게시글 ID를 입력해주세요."),
});
export type TogglePostLikesSchema = z.infer<typeof togglePostLikesSchema>;

/** 게시글 수정 요청 스키마. */
export const updatePostSchema = z.object({
  title: z
    .string()
    .min(1, "제목을 입력해주세요.")
    .max(255, "제목은 최대 255자까지 가능합니다.")
    .optional(),

  category: z
    .enum(post_category, {
      message: "존재하지 않는 카테고리 입니다.",
    })
    .optional(),

  content: z.string().min(1, "내용을 입력해주세요.").optional(),

  blobUrlMapping: z
    .union([z.string(), z.record(z.string(), z.number())])
    .optional()
    .transform((val) => {
      if (!val) return {};
      if (typeof val === "string") {
        try {
          return JSON.parse(val);
        } catch {
          return {};
        }
      }
      return val;
    })
    .default({}),
});

/** 게시글 목록 조회 쿼리 스키마. */
export const getPostListSchema = z.object({
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
      if (val === undefined || val === null || val === "") return 20;
      if (typeof val === "string") return parseInt(val, 10);
      if (typeof val === "number") return val;
      return 20;
    }, z.number().int().min(1).max(20).default(20))
    .default(20),

  sort: z
    .enum(
      ["created_at", "view_count", "comment_count", "like_count", "title"],
      {
        message: "올바른 정렬 필드를 선택해주세요.",
      }
    )
    .optional()
    .default("created_at"),

  order: z
    .enum(["asc", "desc"], {
      message: "정렬 방향은 asc 또는 desc여야 합니다.",
    })
    .optional()
    .default("desc"),

  search: z.string().optional(),

  category: z
    .enum(post_category, {
      message: "존재하지 않는 카테고리 입니다.",
    })
    .optional(),
});

export type GetPostListSchema = z.infer<typeof getPostListSchema>;

/** 게시글 목록 응답 인터페이스. */
export interface PostListResponse {
  list: ReturnType<typeof toPostResponse>[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

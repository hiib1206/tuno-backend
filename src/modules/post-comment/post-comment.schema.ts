import { z } from "zod";

// 댓글 생성 스키마
export const createPostCommentSchema = z.object({
  content: z
    .string()
    .min(1, "댓글 내용을 입력해주세요.")
    .max(1000, "댓글은 최대 1000자까지 가능합니다."),

  // 대댓글용 (선택사항)
  parent_id: z
    .string()
    .regex(/^\d+$/, "부모 댓글 ID는 숫자여야 합니다.")
    .optional()
    .transform((val) => (val ? BigInt(val) : undefined)),
});

export type CreatePostCommentSchema = z.infer<typeof createPostCommentSchema>;

// 댓글 목록 조회 스키마 (쿼리 파라미터)
export const getPostCommentListSchema = z.object({
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

  order: z.enum(["asc", "desc"]).default("asc"),
});

export type GetPostCommentListSchema = z.infer<typeof getPostCommentListSchema>;

// 댓글 ID 파라미터 검증
export const getPostCommentSchema = z.object({
  id: z
    .string()
    .min(1, "댓글 ID를 입력해주세요.")
    .regex(/^\d+$/, "댓글 ID는 숫자여야 합니다."),
});

export type GetPostCommentSchema = z.infer<typeof getPostCommentSchema>;

// 댓글 수정 스키마
export const updatePostCommentSchema = z.object({
  content: z
    .string()
    .min(1, "댓글 내용을 입력해주세요.")
    .max(1000, "댓글은 최대 1000자까지 가능합니다.")
    .optional(),
});

export type UpdatePostCommentSchema = z.infer<typeof updatePostCommentSchema>;

// 나의 댓글 목록 조회 스키마 (쿼리 파라미터)
export const getMyCommentListSchema = z.object({
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
    .enum(["created_at"], {
      message: "올바른 정렬 필드를 선택해주세요.",
    })
    .optional()
    .default("created_at"),

  order: z
    .enum(["asc", "desc"], {
      message: "정렬 방향은 asc 또는 desc여야 합니다.",
    })
    .optional()
    .default("desc"),
});

export type GetMyCommentListSchema = z.infer<typeof getMyCommentListSchema>;

// 여러 댓글 삭제 (Body에 ID 배열)
export const deleteCommentsSchema = z.object({
  ids: z
    .array(z.string().regex(/^\d+$/, "댓글 ID는 숫자여야 합니다."))
    .min(1, "최소 1개 이상의 댓글 ID를 입력해주세요."),
});
export type DeleteCommentsSchema = z.infer<typeof deleteCommentsSchema>;

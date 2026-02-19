import { z } from "zod";

// ── 요청 스키마 ──

// 뉴스 목록 조회 쿼리 스키마 (커서 페이지네이션)
export const getNewsListSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(10).default(10),
});
export type GetNewsListSchema = z.infer<typeof getNewsListSchema>;

// 토픽별 뉴스 조회 파라미터 스키마
export const getNewsByTopicParamsSchema = z.object({
  topics: z.string(),
});
export type GetNewsByTopicParamsSchema = z.infer<
  typeof getNewsByTopicParamsSchema
>;

// 뉴스 이미지 추출 작업 예약 스키마
export const createNewsJobSchema = z.object({
  urls: z.array(z.string().url()).min(1).max(20),
});
export type CreateNewsJobSchema = z.infer<typeof createNewsJobSchema>;

// 뉴스 이미지 추출 스트림 파라미터 스키마
export const streamNewsJobParamsSchema = z.object({
  jobId: z.string().uuid(),
});
export type StreamNewsJobParamsSchema = z.infer<
  typeof streamNewsJobParamsSchema
>;

// 검색 뉴스 조회 쿼리 스키마 (커서 페이지네이션)
export const getNewsBySearchSchema = z.object({
  q: z
    .string()
    .trim()
    .min(1, "검색어는 필수입니다.")
    .max(200, "검색어는 200자 이하여야 합니다."),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(30).default(10),
});
export type GetNewsBySearchSchema = z.infer<typeof getNewsBySearchSchema>;

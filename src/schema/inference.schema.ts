import { z } from "zod";
import { ai_model_type, inference_status } from "../generated/prisma/enums";

export const snapbackInferenceBodySchema = z.object({
  ticker: z
    .string()
    .min(1, "종목코드를 입력해 주세요.")
    .max(16, "종목코드는 최대 16자리입니다.")
    .regex(/^[A-Z0-9]+$/, "종목코드는 영문/숫자만 가능합니다."),
  date: z
    .string()
    .regex(/^\d{8}$/, "date는 YYYYMMDD 형식이어야 합니다.")
    .nullable()
    .optional(),
});

export type SnapbackInferenceBodySchema = z.infer<
  typeof snapbackInferenceBodySchema
>;

// Quant Signal 추론 요청 스키마
export const quantSignalInferenceBodySchema = z.object({
  ticker: z
    .string()
    .min(1, "종목코드를 입력해 주세요.")
    .max(16, "종목코드는 최대 16자리입니다.")
    .regex(/^[A-Z0-9]+$/, "종목코드는 영문/숫자만 가능합니다."),
  date: z
    .string()
    .regex(/^\d{8}$/, "date는 YYYYMMDD 형식이어야 합니다.")
    .nullable()
    .optional(),
});

export type QuantSignalInferenceBodySchema = z.infer<
  typeof quantSignalInferenceBodySchema
>;

// AI 추론 이력 조회 스키마 (쿼리 파라미터) - 커서 기반 페이지네이션
export const getInferenceHistoryQuerySchema = z.object({
  cursor: z
    .string()
    .regex(/^\d+$/, "커서는 숫자여야 합니다.")
    .optional(),

  limit: z
    .preprocess((val) => {
      if (val === undefined || val === null || val === "") return 20;
      if (typeof val === "string") return parseInt(val, 10);
      if (typeof val === "number") return val;
      return 20;
    }, z.number().int().min(1).max(50).default(20))
    .default(20),

  model_type: z
    .enum(Object.values(ai_model_type) as [ai_model_type, ...ai_model_type[]])
    .optional(),

  ticker: z
    .string()
    .max(16)
    .regex(/^[A-Z0-9]+$/)
    .optional(),

  days: z
    .preprocess((val) => {
      if (val === undefined || val === null || val === "") return undefined;
      if (typeof val === "string") return parseInt(val, 10);
      if (typeof val === "number") return val;
      return undefined;
    }, z.number().int().min(1).max(180).optional())
    .optional(),

  status: z
    .enum(
      Object.values(inference_status) as [
        inference_status,
        ...inference_status[],
      ]
    )
    .optional(),

  all: z
    .preprocess((val) => val === "true" || val === true, z.boolean().optional())
    .optional(),
}).refine(
  (data) => !(data.all === true && !data.days),
  { message: "all=true일 때는 days가 필수입니다.", path: ["all"] }
);

export type GetInferenceHistoryQuerySchema = z.infer<
  typeof getInferenceHistoryQuerySchema
>;

// AI 추론 이력 단건 조회 스키마 (path parameter)
export const getInferenceHistoryByIdParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, "id는 숫자여야 합니다."),
});

export type GetInferenceHistoryByIdParamsSchema = z.infer<
  typeof getInferenceHistoryByIdParamsSchema
>;


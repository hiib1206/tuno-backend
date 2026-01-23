import { z } from "zod";

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


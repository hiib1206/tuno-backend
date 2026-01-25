import { z } from "zod";

// 특이테마 조회 쿼리 파라미터 검증
export const getSpecialThemesSchema = z.object({
  gubun: z
    .enum(["1", "2", "3", "4", "5", "6", "7", "8"], {
      message:
        "gubun은 1~8 중 하나여야 합니다. (1:상승율상위, 2:하락율상위, 3:거래증가율상위, 4:거래증가율하위, 5:상승종목비율상위, 6:상승종목비율하위, 7:기준대비상승율상위, 8:기준대비하락율상위)",
    })
    .optional()
    .default("1"),
});

export type GetSpecialThemesSchema = z.infer<typeof getSpecialThemesSchema>;

// 테마 종목 조회 경로 파라미터 검증
export const getThemeStocksParamsSchema = z.object({
  tmcode: z
    .string()
    .min(1, "테마코드를 입력해주세요.")
    .max(4, "테마코드는 최대 4자리입니다."),
});

export type GetThemeStocksParamsSchema = z.infer<
  typeof getThemeStocksParamsSchema
>;

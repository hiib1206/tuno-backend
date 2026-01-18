import { z } from "zod";

// 종목코드 경로 파라미터 검증
export const getStockCodeSchema = z.object({
  code: z
    .string()
    .min(1, "종목코드를 입력해주세요.")
    .max(16, "종목코드는 최대 16자리입니다.")
    .regex(/^[A-Z0-9]+$/, "종목코드는 영문자와 숫자만 가능합니다."),
});

// 재무 요약 조회 쿼리 파라미터 검증
export const getDomesticFinancialSummarySchema = z.object({
  period: z
    .enum(["y", "q"], {
      message: "기간은 'y'(연간) 또는 'q'(분기)여야 합니다.",
    })
    .optional(),

  limit: z
    .preprocess((val) => {
      if (val === undefined || val === null || val === "") return 4;
      if (typeof val === "string") return parseInt(val, 10);
      if (typeof val === "number") return val;
      return 4;
    }, z.number().int().min(1).default(4))
    .default(4),

  order: z
    .enum(["asc", "desc"], {
      message: "정렬 방향은 asc 또는 desc여야 합니다.",
    })
    .optional()
    .default("desc"),
});

export type GetDomesticFinancialSummarySchema = z.infer<
  typeof getDomesticFinancialSummarySchema
>;

// 주식 마스터 조회 쿼리 파라미터 검증 (국내/해외 통합)
export const getStockMasterSchema = z.object({
  market: z.enum(["KR", "US"], {
    message: "시장은 'KR'(국내) 또는 'US'(미국)여야 합니다.",
  }),
  exchange: z.enum(["KP", "KQ", "NAS", "NYS", "AMS"], {
    message:
      "거래소 코드가 올바르지 않습니다. (KP, KQ, NAS, NYS, AMS 중 하나여야 합니다.)",
  }),
});

export type GetStockMasterSchema = z.infer<typeof getStockMasterSchema>;

// 주식 캔들 데이터 조회 쿼리 파라미터 검증
export const getStockCandleSchema = z
  .object({
    market: z.enum(["KR", "US"], {
      message: "시장은 'KR'(국내) 또는 'US'(미국)여야 합니다.",
    }),
    exchange: z.enum(
      // "KN", "HKG", "TSE"등은 나중에 확장되면 추가 가능
      ["KP", "KQ", "NAS", "NYS", "AMS"],
      {
        message:
          "거래소 코드가 올바르지 않습니다. (KP, KQ, NAS, NYS, AMS 중 하나여야 합니다.)",
      }
    ),
    code: z
      .string()
      .min(1, "종목코드를 입력해주세요.")
      .max(16, "종목코드는 최대 16자리입니다."),
    interval: z.enum(["1d"], {
      message: "interval은 '1d'(일봉)만 지원됩니다.",
    }),
    limit: z.coerce
      .number()
      .int()
      .min(1, "limit은 최소 1이어야 합니다.")
      .max(1000, "limit은 최대 1000입니다.")
      .optional(),
    from: z.preprocess((val) => {
      if (val === undefined || val === null || val === "") return undefined;
      if (typeof val === "string") return parseInt(val, 10);
      if (typeof val === "number") return val;
      return undefined;
    }, z.number().int().min(0).optional()),
    to: z.preprocess((val) => {
      if (val === undefined || val === null || val === "") return undefined;
      if (typeof val === "string") return parseInt(val, 10);
      if (typeof val === "number") return val;
      return undefined;
    }, z.number().int().min(0).optional()),
  })
  .refine(
    (data) => {
      const hasFromTo = data.from !== undefined && data.to !== undefined;
      const hasToLimit = data.to !== undefined && data.limit !== undefined;
      const hasLimitOnly =
        data.limit !== undefined &&
        data.from === undefined &&
        data.to === undefined;

      // from, to, limit 모두 있으면 에러
      if (hasFromTo && data.limit !== undefined) return false;

      // 셋 중 하나는 만족해야 함
      return hasFromTo || hasToLimit || hasLimitOnly;
    },
    {
      message:
        "기간 조회: from+to, 과거 스크롤: to+limit, 최근 조회: limit만 제공해야 합니다.",
    }
  );

export type GetStockCandleSchema = z.infer<typeof getStockCandleSchema>;

// 국내 주식 현재가 조회 쿼리 파라미터 검증
export const getDomesticStockQuoteSchema = z.object({
  market_division_code: z.enum(["J", "NX", "UN"], {
    message:
      "시장 구분은 'J'(KRX), 'NX'(KONEX), 'UN'(통합) 중 하나여야 합니다.",
  }),
  period_type: z.enum(["D", "W", "M"], {
    message: "기간 분류는 'D'(일), 'W'(주), 'M'(월) 중 하나여야 합니다.",
  }),
});

export type GetDomesticStockQuoteSchema = z.infer<
  typeof getDomesticStockQuoteSchema
>;

// 주식 검색 쿼리 파라미터 검증
export const searchStockSchema = z.object({
  q: z
    .string()
    .min(1, "검색어를 입력해주세요.")
    .max(50, "검색어는 최대 50자까지 입력 가능합니다."),
  type: z
    .enum(["all", "domestic", "overseas"], {
      message: "검색 타입은 'all', 'domestic', 'overseas' 중 하나여야 합니다.",
    })
    .optional()
    .default("all"),
  limit: z.coerce
    .number()
    .int()
    .min(1, "limit은 최소 1이어야 합니다.")
    .max(50, "limit은 최대 50입니다.")
    .optional()
    .default(10),
});

export type SearchStockSchema = z.infer<typeof searchStockSchema>;

// 관심종목 토글 쿼리 파라미터 검증
export const toggleWatchlistSchema = z.object({
  exchange: z.enum(["KP", "KQ", "NAS", "NYS", "AMS"], {
    message:
      "거래소 코드가 올바르지 않습니다. (KP, KQ, NAS, NYS, AMS 중 하나여야 합니다.)",
  }),
});
export type ToggleWatchlistSchema = z.infer<typeof toggleWatchlistSchema>;

// 관심종목 목록 조회 쿼리 파라미터 검증
export const getWatchlistSchema = z.object({
  exchange: z
    .enum(["KP", "KQ", "NAS", "NYS", "AMS"], {
      message:
        "거래소 코드가 올바르지 않습니다. (KP, KQ, NAS, NYS, AMS 중 하나여야 합니다.)",
    })
    .optional(),
});
export type GetWatchlistSchema = z.infer<typeof getWatchlistSchema>;

// 관심종목 순서 변경 body 검증
export const updateWatchlistOrderSchema = z.object({
  order: z
    .array(
      z.object({
        exchange: z.enum(["KP", "KQ", "NAS", "NYS", "AMS"], {
          message:
            "거래소 코드가 올바르지 않습니다. (KP, KQ, NAS, NYS, AMS 중 하나여야 합니다.)",
        }),
        code: z
          .string()
          .min(1, "종목코드를 입력해주세요.")
          .max(16, "종목코드는 최대 16자리입니다.")
          .regex(/^[A-Z0-9]+$/, "종목코드는 영문자와 숫자만 가능합니다."),
      })
    )
    .min(1, "순서 배열은 최소 1개 이상이어야 합니다.")
    .max(100, "순서 배열은 최대 100개까지 가능합니다."),
});
export type UpdateWatchlistOrderSchema = z.infer<
  typeof updateWatchlistOrderSchema
>;

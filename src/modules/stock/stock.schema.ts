import { z } from "zod";

// ── 요청 스키마 ──

// 종목코드 경로 파라미터 검증
export const getStockCodeSchema = z.object({
  code: z
    .string()
    .min(1, "종목코드를 입력해주세요.")
    .max(16, "종목코드는 최대 16자리입니다.")
    .regex(/^[A-Z0-9]+$/, "종목코드는 영문자와 숫자만 가능합니다."),
});

export type GetStockCodeSchema = z.infer<typeof getStockCodeSchema>;

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

// 주식 마스터 조회 쿼리 파라미터 검증 (국내만)
export const getStockMasterSchema = z.object({
  market: z.literal("KR", {
    message: "시장은 'KR'(국내)만 지원됩니다.",
  }),
  exchange: z.enum(["KP", "KQ"], {
    message: "거래소 코드는 'KP'(코스피) 또는 'KQ'(코스닥)여야 합니다.",
  }),
});

export type GetStockMasterSchema = z.infer<typeof getStockMasterSchema>;

// 주식 캔들 데이터 조회 쿼리 파라미터 검증 (국내만)
export const getStockCandleSchema = z
  .object({
    market: z.literal("KR", {
      message: "시장은 'KR'(국내)만 지원됩니다.",
    }),
    exchange: z.enum(["KP", "KQ"], {
      message: "거래소 코드는 'KP'(코스피) 또는 'KQ'(코스닥)여야 합니다.",
    }),
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

// 국내 지수 캔들 데이터 조회 쿼리 파라미터 검증
export const getIndexCandleSchema = z
  .object({
    code: z
      .string()
      .min(1, "업종 코드를 입력해주세요.")
      .max(4, "업종 코드는 최대 4자리입니다."),
    interval: z.enum(["1d", "1w", "1m", "1y"], {
      message:
        "interval은 '1d'(일), '1w'(주), '1m'(월), '1y'(년) 중 하나여야 합니다.",
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

      if (hasFromTo && data.limit !== undefined) return false;

      return hasFromTo || hasToLimit || hasLimitOnly;
    },
    {
      message:
        "기간 조회: from+to, 과거 스크롤: to+limit, 최근 조회: limit만 제공해야 합니다.",
    }
  );

export type GetIndexCandleSchema = z.infer<typeof getIndexCandleSchema>;

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

// 국내 주식 호가 조회 쿼리 파라미터 검증
export const getOrderbookSchema = z.object({
  market_division_code: z.enum(["J", "NX", "UN"], {
    message:
      "시장 구분은 'J'(KRX), 'NX'(NXT), 'UN'(통합) 중 하나여야 합니다.",
  }),
});

export type GetOrderbookSchema = z.infer<typeof getOrderbookSchema>;

// 주식 검색 쿼리 파라미터 검증 (국내만)
export const searchStockSchema = z.object({
  q: z
    .string()
    .min(1, "검색어를 입력해주세요.")
    .max(50, "검색어는 최대 50자까지 입력 가능합니다."),
  type: z
    .enum(["all", "domestic"], {
      message: "검색 타입은 'all', 'domestic' 중 하나여야 합니다.",
    })
    .optional()
    .default("domestic"),
  limit: z.coerce
    .number()
    .int()
    .min(1, "limit은 최소 1이어야 합니다.")
    .optional(),
});

export type SearchStockSchema = z.infer<typeof searchStockSchema>;

// 관심종목 토글 쿼리 파라미터 검증 (국내만)
export const toggleWatchlistSchema = z.object({
  exchange: z.enum(["KP", "KQ"], {
    message: "거래소 코드는 'KP'(코스피) 또는 'KQ'(코스닥)여야 합니다.",
  }),
});
export type ToggleWatchlistSchema = z.infer<typeof toggleWatchlistSchema>;

// 관심종목 목록 조회 쿼리 파라미터 검증 (국내만)
export const getWatchlistSchema = z.object({
  exchange: z
    .enum(["KP", "KQ"], {
      message: "거래소 코드는 'KP'(코스피) 또는 'KQ'(코스닥)여야 합니다.",
    })
    .optional(),
});
export type GetWatchlistSchema = z.infer<typeof getWatchlistSchema>;

// 관심종목 순서 변경 body 검증 (국내만)
export const updateWatchlistOrderSchema = z.object({
  order: z
    .array(
      z.object({
        exchange: z.enum(["KP", "KQ"], {
          message: "거래소 코드는 'KP'(코스피) 또는 'KQ'(코스닥)여야 합니다.",
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

// 국내 지수 현재가 조회 경로 파라미터 검증
export const getIndexPriceParamsSchema = z.object({
  industryCode: z
    .string()
    .regex(/^\d{4}$/, "업종 코드는 4자리 숫자여야 합니다."),
});
export type GetIndexPriceParamsSchema = z.infer<
  typeof getIndexPriceParamsSchema
>;

// 국내 지수 분봉 차트 조회 쿼리 파라미터 검증
export const getIndexMinuteChartQuerySchema = z.object({
  interval: z
    .enum(["30", "60", "600", "3600"], {
      message: "interval은 30, 60, 600, 3600 중 하나여야 합니다.",
    })
    .default("60"),
  include_past_data: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  exclude_after_hours: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});
export type GetIndexMinuteChartQuerySchema = z.infer<
  typeof getIndexMinuteChartQuerySchema
>;

// ── 응답 타입 ──

export type StockCandleItem = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  turnover: number;
};

export type StockInfo = {
  market: "KR";
  exchange: "KP" | "KQ";
  code: string;
  nameKo: string;
  nameEn: null;
  listedAt: string | null;
  isNxtInMaster: boolean | null;
  isInWatchlist?: boolean;
  summary?: string | null;
};

export type DomesticStockQuote = {
  code: string;

  currentPrice: number | null;
  priceChange: number | null;
  priceChangeSign: string;
  priceChangeRate: number | null;

  previousClose: number | null;
  open: number | null;
  high: number | null;
  low: number | null;

  volume: number | null;
  tradingValue: number | null;

  high52Week: number | null;
  low52Week: number | null;

  listedShares: number | null;
  capital: number | null;
  parValue: number | null;

  bsopDate: string | null;
  statusCode?: string | null;
};

export type StockSearchResult = StockInfo & {
  type: "domestic";
};

export type StockOrderbook = {
  MKSC_SHRN_ISCD?: string;
  BSOP_HOUR?: string;
  HOUR_CLS_CODE?: string;

  ASKP1: number;
  ASKP2: number;
  ASKP3: number;
  ASKP4: number;
  ASKP5: number;
  ASKP6: number;
  ASKP7: number;
  ASKP8: number;
  ASKP9: number;
  ASKP10: number;

  BIDP1: number;
  BIDP2: number;
  BIDP3: number;
  BIDP4: number;
  BIDP5: number;
  BIDP6: number;
  BIDP7: number;
  BIDP8: number;
  BIDP9: number;
  BIDP10: number;

  ASKP_RSQN1: number;
  ASKP_RSQN2: number;
  ASKP_RSQN3: number;
  ASKP_RSQN4: number;
  ASKP_RSQN5: number;
  ASKP_RSQN6: number;
  ASKP_RSQN7: number;
  ASKP_RSQN8: number;
  ASKP_RSQN9: number;
  ASKP_RSQN10: number;

  BIDP_RSQN1: number;
  BIDP_RSQN2: number;
  BIDP_RSQN3: number;
  BIDP_RSQN4: number;
  BIDP_RSQN5: number;
  BIDP_RSQN6: number;
  BIDP_RSQN7: number;
  BIDP_RSQN8: number;
  BIDP_RSQN9: number;
  BIDP_RSQN10: number;

  TOTAL_ASKP_RSQN: number;
  TOTAL_BIDP_RSQN: number;
  OVTM_TOTAL_ASKP_RSQN: number;
  OVTM_TOTAL_BIDP_RSQN: number;

  ANTC_CNPR?: number;
  ANTC_CNQN?: number;
  ANTC_VOL?: number;
  ANTC_CNTG_VRSS?: number;
  ANTC_CNTG_VRSS_SIGN?: string;
  ANTC_CNTG_PRDY_CTRT?: number;

  ACML_VOL?: number;
  TOTAL_ASKP_RSQN_ICDC?: number;
  TOTAL_BIDP_RSQN_ICDC?: number;
  OVTM_TOTAL_ASKP_ICDC?: number;
  OVTM_TOTAL_BIDP_ICDC?: number;
  STCK_DEAL_CLS_CODE?: string;
};

export type DomesticIndexMinuteCandle = {
  date: number;
  time: string;
  close: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  tickVolume: number | null;
  tradingValue: number | null;
};

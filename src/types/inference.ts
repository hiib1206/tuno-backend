// Snapback V2 응답 타입

/** AI 서버 추론 에러 코드 (비즈니스 로직상 추론 불가) */
export const InferenceErrorCode = {
  INSUFFICIENT_DATA: "INSUFFICIENT_DATA",
  NO_BASE_POINT: "NO_BASE_POINT",
  BASE_POINT_EXPIRED: "BASE_POINT_EXPIRED",
  INVALID_MODEL_CONFIG: "INVALID_MODEL_CONFIG",
} as const;

export type InferenceErrorCode =
  (typeof InferenceErrorCode)[keyof typeof InferenceErrorCode];

export type BasePointInfo = {
  date: string;
  price: number;
};

export type CurrentInfo = {
  date: string;
  price: number;
  drop_pct: number;
};

export type ATRInfo = {
  value: number;
  pct: number;
  bounce_threshold: number;
  bounce_amount: number;
};

export type SupportInfo = {
  level: number;
  drop_pct: number;
  price: number;
};


export type SnapbackV2Response = {
  ticker: string;
  base_point: BasePointInfo;
  current: CurrentInfo;
  days_since_base: number;
  atr: ATRInfo;
  supports: SupportInfo[];
  status: "above_base" | "active" | "partial" | "breached";
};

// AI 추론 이력 아이템 타입
export type InferenceHistoryItem = {
  id: string;
  user_id: number | null;
  model_type: "SNAPBACK" | "QUANT_SIGNAL";
  model_version: string | null;
  ticker: string | null;
  exchange: string | null;
  request_params: {
    ticker: string;
    date?: string;
  };
  response_data: SnapbackV2Response | QuantSignalV1Response | null;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELED";
  latency_ms: number | null;
  requested_at: Date;
  completed_at: Date | null;
  deleted_at: Date | null;
  nameKo: string | null;
};

// AI 추론 이력 목록 조회 응답 타입
export type InferenceHistoryListResponse = {
  items: InferenceHistoryItem[];
  nextCursor: string | null;
  hasNext: boolean;
};

// ===== Quant Signal V1 응답 타입 =====

export type QuantSignalType = "BUY" | "HOLD" | "SELL";

export type QuantSignalProbabilities = {
  sell: number;
  hold: number;
  buy: number;
};

export type QuantSignalIndicators = {
  trend_ma_60_120: number;
  trend_strength: number;
  ma_diff_60: number;
  momentum_20d: number;
  momentum_60d: number;
  rsi_14: number;
  macd_hist_slope: number;
  atr_pct: number;
  volatility_regime: number;
  bb_position: number;
  relative_strength_20d: number;
  relative_strength_60d: number;
  beta: number;
  defensive_strength: number;
  market_stress: number;
  amount_ratio: number;
  amount_trend: number;
  mfi: number;
};

export type QuantSignalReason = {
  summary: string;
  detail: string;
  /** 영향 방향: "up" = 상승 방향 영향, "down" = 하락 방향 영향 */
  direction: "up" | "down";
  /** 영향 강도: 1 = 약한(<5%), 2 = 보통(5-15%), 3 = 강한(15-30%), 4 = 매우 강한(30%+) */
  strength: 1 | 2 | 3 | 4;
  indicator: Partial<Record<keyof QuantSignalIndicators, number>>
};

export type QuantSignalHistoryItem = {
  date: string;
  signal: QuantSignalType;
  price: number;
};

export type QuantSignalModelInfo = {
  model_id: string;
  run_id: string;
};

export type QuantSignalV1Response = {
  ticker: string;
  name: string;
  date: string;
  inferred_at: string;
  current_price: number;
  signal: QuantSignalType;
  confidence: number;
  probabilities: QuantSignalProbabilities;
  indicators: QuantSignalIndicators;
  reasons: QuantSignalReason[];
  signal_history: QuantSignalHistoryItem[];
  model_info: QuantSignalModelInfo;
};

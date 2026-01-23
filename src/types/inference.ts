// Snapback V2 응답 타입

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

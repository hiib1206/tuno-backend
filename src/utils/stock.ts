import { DomesticStockQuote, StockOrderbook } from "../types/stock";

// 빈 문자열, null, undefined -> null
// 숫자로 파싱 가능한 문자열은 number로 변환
const toNullableNumber = (value: string | null | undefined): number | null => {
  if (value == null) return null;

  const trimmed = value.trim();
  if (trimmed === "") return null;

  const num = Number(trimmed.replace(/,/g, ""));
  return Number.isFinite(num) ? num : null;
};

// tuno-ai 국내 주식 현재가 응답 -> 내부 도메인 타입으로 매핑
export const toDomesticStockQuote = (raw: any): DomesticStockQuote => {
  return {
    code: raw.stck_shrn_iscd,

    currentPrice: toNullableNumber(raw.stck_prpr),
    priceChange: toNullableNumber(raw.prdy_vrss),
    priceChangeSign: raw.prdy_vrss_sign,
    priceChangeRate: toNullableNumber(raw.prdy_ctrt),

    previousClose: toNullableNumber(raw.stck_sdpr),
    open: toNullableNumber(raw.stck_oprc),
    high: toNullableNumber(raw.stck_hgpr),
    low: toNullableNumber(raw.stck_lwpr),

    volume: toNullableNumber(raw.acml_vol),
    tradingValue: toNullableNumber(raw.acml_tr_pbmn),

    high52Week: toNullableNumber(raw.w52_hgpr),
    low52Week: toNullableNumber(raw.w52_lwpr),

    listedShares: toNullableNumber(raw.lstn_stcn),
    capital: toNullableNumber(raw.cpfn),
    parValue: toNullableNumber(raw.stck_fcam),

    bsopDate: raw.stck_bsop_date ?? null,
    statusCode: raw.iscd_stat_cls_code ?? null,
  };
};

// 숫자로 변환 (0이 기본값)
const toNumber = (value: string | null | undefined): number => {
  if (value == null) return 0;
  const trimmed = value.trim();
  if (trimmed === "") return 0;
  const num = Number(trimmed.replace(/,/g, ""));
  return Number.isFinite(num) ? num : 0;
};

// tuno-ai 호가 응답 -> StockOrderbook 타입으로 매핑
export const toOrderbook = (output1: any): StockOrderbook => {
  return {
    // 매도호가 (1~10)
    ASKP1: toNumber(output1.askp1),
    ASKP2: toNumber(output1.askp2),
    ASKP3: toNumber(output1.askp3),
    ASKP4: toNumber(output1.askp4),
    ASKP5: toNumber(output1.askp5),
    ASKP6: toNumber(output1.askp6),
    ASKP7: toNumber(output1.askp7),
    ASKP8: toNumber(output1.askp8),
    ASKP9: toNumber(output1.askp9),
    ASKP10: toNumber(output1.askp10),

    // 매수호가 (1~10)
    BIDP1: toNumber(output1.bidp1),
    BIDP2: toNumber(output1.bidp2),
    BIDP3: toNumber(output1.bidp3),
    BIDP4: toNumber(output1.bidp4),
    BIDP5: toNumber(output1.bidp5),
    BIDP6: toNumber(output1.bidp6),
    BIDP7: toNumber(output1.bidp7),
    BIDP8: toNumber(output1.bidp8),
    BIDP9: toNumber(output1.bidp9),
    BIDP10: toNumber(output1.bidp10),

    // 매도호가 잔량 (1~10)
    ASKP_RSQN1: toNumber(output1.askp_rsqn1),
    ASKP_RSQN2: toNumber(output1.askp_rsqn2),
    ASKP_RSQN3: toNumber(output1.askp_rsqn3),
    ASKP_RSQN4: toNumber(output1.askp_rsqn4),
    ASKP_RSQN5: toNumber(output1.askp_rsqn5),
    ASKP_RSQN6: toNumber(output1.askp_rsqn6),
    ASKP_RSQN7: toNumber(output1.askp_rsqn7),
    ASKP_RSQN8: toNumber(output1.askp_rsqn8),
    ASKP_RSQN9: toNumber(output1.askp_rsqn9),
    ASKP_RSQN10: toNumber(output1.askp_rsqn10),

    // 매수호가 잔량 (1~10)
    BIDP_RSQN1: toNumber(output1.bidp_rsqn1),
    BIDP_RSQN2: toNumber(output1.bidp_rsqn2),
    BIDP_RSQN3: toNumber(output1.bidp_rsqn3),
    BIDP_RSQN4: toNumber(output1.bidp_rsqn4),
    BIDP_RSQN5: toNumber(output1.bidp_rsqn5),
    BIDP_RSQN6: toNumber(output1.bidp_rsqn6),
    BIDP_RSQN7: toNumber(output1.bidp_rsqn7),
    BIDP_RSQN8: toNumber(output1.bidp_rsqn8),
    BIDP_RSQN9: toNumber(output1.bidp_rsqn9),
    BIDP_RSQN10: toNumber(output1.bidp_rsqn10),

    // 총 잔량
    TOTAL_ASKP_RSQN: toNumber(output1.total_askp_rsqn),
    TOTAL_BIDP_RSQN: toNumber(output1.total_bidp_rsqn),
    OVTM_TOTAL_ASKP_RSQN: toNumber(output1.ovtm_total_askp_rsqn),
    OVTM_TOTAL_BIDP_RSQN: toNumber(output1.ovtm_total_bidp_rsqn),
  };
};

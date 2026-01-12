import { DomesticStockQuote } from "../types/stock";

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

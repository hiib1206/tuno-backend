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
  market: "KR" | "US"; // 시장 코드
  exchange: "KP" | "KQ" | "NAS" | "NYS" | "AMS"; // 거래소 코드
  code: string; // 종목코드 (단축코드)
  nameKo: string; // 한글 종목명
  nameEn: string | null; // 영문 종목명
  listedAt: string | null; // 상장일자 (YYYYMMDD)
  isNxtInMaster: boolean | null; // 증권사 NXT 종목 마스터 파일 포함 여부
  isInWatchlist?: boolean; // 관심종목 여부 (로그인한 경우에만 포함)
  summary?: string | null; // 기업개요 (국내 주식만)
};

export type DomesticStockQuote = {
  code: string; // 주식 단축 종목코드

  currentPrice: number | null; // 현재가
  priceChange: number | null; // 전일 대비
  priceChangeSign: string; // 전일 대비 부호 (증권사 원본 그대로)
  priceChangeRate: number | null; // 등락률

  previousClose: number | null; // 전일 종가
  open: number | null; // 시가
  high: number | null; // 고가
  low: number | null; // 저가

  volume: number | null; // 거래량
  tradingValue: number | null; // 거래대금

  high52Week: number | null; // 52주 최고가
  low52Week: number | null; // 52주 최저가

  listedShares: number | null; // 상장주수
  capital: number | null; // 자본금
  parValue: number | null; // 액면가

  bsopDate: string | null; // 주식 영업 일자 (YYYYMMDD)
  statusCode?: string | null; // 종목 상태 구분 코드 (예: "51" 관리종목)
};

export type StockSearchResult = StockInfo & {
  type: "domestic" | "overseas"; // 검색 결과 타입
};

// 원본 호가 타입과는 많이 다릅니다(실시간 호가 타입에 맞춰준것)
export type StockOrderbook = {
  /** 유가증권 단축 종목코드 */
  MKSC_SHRN_ISCD?: string;
  /** 영업 시간 (HHMMSS) */
  BSOP_HOUR?: string;
  /** 시간 구분 코드 (0:장중, A:장후예상, B:장전예상, C:9시이후의 예상가/VI발동, D:시간외 단일가 예상) */
  HOUR_CLS_CODE?: string;

  // 매도호가 (1~10)
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

  // 매수호가 (1~10)
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

  // 매도호가 잔량 (1~10)
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

  // 매수호가 잔량 (1~10)
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

  // 총 잔량
  TOTAL_ASKP_RSQN: number;
  TOTAL_BIDP_RSQN: number;
  OVTM_TOTAL_ASKP_RSQN: number;
  OVTM_TOTAL_BIDP_RSQN: number;

  // 예상 체결 정보
  ANTC_CNPR?: number;
  ANTC_CNQN?: number;
  ANTC_VOL?: number;
  ANTC_CNTG_VRSS?: number;
  ANTC_CNTG_VRSS_SIGN?: string;
  ANTC_CNTG_PRDY_CTRT?: number;

  // 기타
  ACML_VOL?: number;
  TOTAL_ASKP_RSQN_ICDC?: number;
  TOTAL_BIDP_RSQN_ICDC?: number;
  OVTM_TOTAL_ASKP_ICDC?: number;
  OVTM_TOTAL_BIDP_ICDC?: number;
  STCK_DEAL_CLS_CODE?: string;
};

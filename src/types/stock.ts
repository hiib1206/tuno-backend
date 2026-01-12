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

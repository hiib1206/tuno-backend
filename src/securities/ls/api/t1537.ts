import { lsRequest } from "../client";
import { API_PATH } from "../constants";

export type T1537InBlock = {
  tmcode: string; // 테마코드 (t8425에서 조회)
};

export type T1537Request = {
  t1537InBlock: T1537InBlock;
};

export type T1537OutBlock = {
  upcnt: number; // 상승종목수
  tmcnt: number; // 테마종목수
  uprate: number; // 상승종목비율
  tmname: string; // 테마명
};

export type T1537OutBlock1Item = {
  hname: string; // 종목명
  price: number; // 현재가
  sign: string; // 전일대비구분
  change: number; // 전일대비
  diff: number; // 등락율
  volume: number; // 누적거래량
  jniltime: number; // 전일동시간
  shcode: string; // 종목코드
  yeprice: number; // 예상체결가
  open: number; // 시가
  high: number; // 고가
  low: number; // 저가
  value: number; // 누적거래대금(백만)
  marketcap: number; // 시가총액(백만)
};

export type T1537Response = {
  rsp_cd: string;
  rsp_msg: string;
  t1537OutBlock: T1537OutBlock;
  t1537OutBlock1: T1537OutBlock1Item[];
};

export type GetThemeStocksResult = {
  info: T1537OutBlock;
  stocks: T1537OutBlock1Item[];
};

/** 테마 종목별 시세를 조회한다 (t1537). */
export const getThemeStocks = async (
  tmcode: string
): Promise<GetThemeStocksResult> => {
  const response = await lsRequest<T1537Response>({
    trCode: "t1537",
    path: API_PATH.SECTOR,
    body: {
      t1537InBlock: {
        tmcode,
      },
    },
  });

  return {
    info: response.t1537OutBlock,
    stocks: response.t1537OutBlock1,
  };
};

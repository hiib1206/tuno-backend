import { lsRequest } from "../client";
import { API_PATH } from "../constants";

// ===== 타입 정의 =====

// 요청
export type T1533Gubun =
  | "1" // 상승율 상위
  | "2" // 하락율 상위
  | "3" // 거래증가율 상위
  | "4" // 거래증가율 하위
  | "5" // 상승종목비율 상위
  | "6" // 상승종목비율 하위
  | "7" // 기준대비 상승율 상위
  | "8"; // 기준대비 하락율 상위

export type T1533InBlock = {
  gubun: T1533Gubun; // 구분
  chgdate: number; // 대비일자
};

export type T1533Request = {
  t1533InBlock: T1533InBlock;
};

// 응답
export type T1533OutBlock = {
  bdate: string; // 일자
};

export type T1533OutBlock1Item = {
  tmname: string; // 테마명
  totcnt: number; // 전체
  upcnt: number; // 상승
  dncnt: number; // 하락
  uprate: number; // 상승비율
  diff_vol: number; // 거래증가율
  avgdiff: number; // 평균등락율
  chgdiff: number; // 대비등락율
  tmcode: string; // 테마코드
};

export type T1533Response = {
  rsp_cd: string;
  rsp_msg: string;
  t1533OutBlock: T1533OutBlock;
  t1533OutBlock1: T1533OutBlock1Item[];
};

export type GetSpecialThemesResult = {
  info: T1533OutBlock;
  themes: T1533OutBlock1Item[];
};

// ===== API 함수 =====

export type GetSpecialThemesParams = {
  gubun: T1533Gubun;
  chgdate?: number; // 기본값 0
};

/**
 * 특이테마 조회 (t1533)
 */
export const getSpecialThemes = async (
  params: GetSpecialThemesParams
): Promise<GetSpecialThemesResult> => {
  const response = await lsRequest<T1533Response>({
    trCode: "t1533",
    path: API_PATH.SECTOR,
    body: {
      t1533InBlock: {
        gubun: params.gubun,
        chgdate: params.chgdate ?? 0,
      },
    },
  });

  return {
    info: response.t1533OutBlock,
    themes: response.t1533OutBlock1,
  };
};

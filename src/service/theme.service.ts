import redis from "../config/redis";
import {
  getSpecialThemes,
  T1533Gubun,
  T1533OutBlock1Item,
} from "../securities/ls/api/t1533";
import {
  getThemeStocks,
  T1537OutBlock,
  T1537OutBlock1Item,
} from "../securities/ls/api/t1537";

const CACHE_KEY_THEME_SPECIAL = "ls:theme:special";
const CACHE_KEY_THEME_STOCKS = "ls:theme:stocks";
const CACHE_TTL = 5; // 5초

export type SpecialThemesResult = {
  top: T1533OutBlock1Item[]; // 앞 15개
  bottom: T1533OutBlock1Item[]; // 뒤 15개
};

export const getSpecialThemesService = async (
  gubun: T1533Gubun
): Promise<SpecialThemesResult> => {
  const cacheKey = `${CACHE_KEY_THEME_SPECIAL}:${gubun}`;

  // 캐시 확인
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // LS API 호출
  const result = await getSpecialThemes({ gubun });
  const themes = result.themes;

  // 앞 15개 + 뒤 15개 추출
  const data: SpecialThemesResult = {
    top: themes.slice(0, 15),
    bottom: themes.slice(-15),
  };

  // 캐시 저장 (5초)
  await redis.set(cacheKey, JSON.stringify(data), "EX", CACHE_TTL);

  return data;
};

// 테마 종목 조회
export type ThemeStocksResult = {
  info: T1537OutBlock;
  stocks: T1537OutBlock1Item[];
};

export const getThemeStocksService = async (
  tmcode: string
): Promise<ThemeStocksResult> => {
  const cacheKey = `${CACHE_KEY_THEME_STOCKS}:${tmcode}`;

  // 캐시 확인
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // LS API 호출
  const result = await getThemeStocks(tmcode);

  // 캐시 저장 (5초)
  await redis.set(cacheKey, JSON.stringify(result), "EX", CACHE_TTL);

  return result;
};

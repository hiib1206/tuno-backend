import prisma from "../config/prisma";
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
import { getWithLock } from "../utils/redis";

const CACHE_KEY_THEME_SPECIAL = "ls:theme:special";
const CACHE_KEY_THEME_STOCKS = "ls:theme:stocks";
const CACHE_TTL = 1.5; // 1.5초

export type SpecialThemesResult = {
  top: T1533OutBlock1Item[]; // 앞 15개
  bottom: T1533OutBlock1Item[]; // 뒤 15개
};

export const getSpecialThemesService = async (
  gubun: T1533Gubun
): Promise<SpecialThemesResult> => {
  const cacheKey = `${CACHE_KEY_THEME_SPECIAL}:${gubun}`;

  return getWithLock(
    cacheKey,
    async () => {
      const result = await getSpecialThemes({ gubun });
      const themes = result.themes;
      return { top: themes.slice(0, 10), bottom: themes.slice(-10) };
    },
    CACHE_TTL
  );
};

// 테마 종목 조회
export type ThemeStockWithExchange = T1537OutBlock1Item & {
  exchange: string | null;
};

export type ThemeStocksResult = {
  info: T1537OutBlock;
  stocks: ThemeStockWithExchange[];
};

export const getThemeStocksService = async (
  tmcode: string
): Promise<ThemeStocksResult> => {
  const cacheKey = `${CACHE_KEY_THEME_STOCKS}:${tmcode}`;

  return getWithLock(
    cacheKey,
    async () => {
      const result = await getThemeStocks(tmcode);

      // 종목코드로 market_code 조회
      const shcodes = result.stocks.map((s) => s.shcode);
      const masters = await prisma.krx_stock_master.findMany({
        where: { mksc_shrn_iscd: { in: shcodes } },
        select: { mksc_shrn_iscd: true, market_code: true },
      });
      const marketMap = new Map(
        masters.map((m) => [m.mksc_shrn_iscd, m.market_code])
      );

      const stocksWithExchange: ThemeStockWithExchange[] = result.stocks.map(
        (s) => ({
          ...s,
          exchange: marketMap.get(s.shcode) ?? null,
        })
      );

      return { info: result.info, stocks: stocksWithExchange };
    },
    CACHE_TTL
  );
};

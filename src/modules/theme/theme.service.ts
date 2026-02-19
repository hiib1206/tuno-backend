import prisma from "../../config/prisma";
import { getSpecialThemes, T1533Gubun } from "../../securities/ls/api/t1533";
import { getThemeStocks } from "../../securities/ls/api/t1537";
import { wrapLSError } from "../../securities/ls";
import { getWithLock } from "../../shared/utils/redis";
import {
  SpecialThemesResult,
  ThemeStockWithExchange,
  ThemeStocksResult,
} from "./theme.schema";

const CACHE_KEY_THEME_SPECIAL = "ls:theme:special";
const CACHE_KEY_THEME_STOCKS = "ls:theme:stocks";
const CACHE_TTL = 1.5;

/** 특이테마를 조회한다. */
export const getSpecialThemesService = async (
  gubun: T1533Gubun
): Promise<SpecialThemesResult> => {
  try {
    const cacheKey = `${CACHE_KEY_THEME_SPECIAL}:${gubun}`;

    return await getWithLock(
      cacheKey,
      async () => {
        const result = await getSpecialThemes({ gubun });
        const themes = result.themes;
        return { top: themes.slice(0, 10), bottom: themes.slice(-10) };
      },
      CACHE_TTL
    );
  } catch (error) {
    return wrapLSError(error);
  }
};

/** 테마 종목을 조회한다. */
export const getThemeStocksService = async (
  tmcode: string
): Promise<ThemeStocksResult> => {
  try {
    const cacheKey = `${CACHE_KEY_THEME_STOCKS}:${tmcode}`;

    return await getWithLock(
      cacheKey,
      async () => {
        const result = await getThemeStocks(tmcode);

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
  } catch (error) {
    return wrapLSError(error);
  }
};

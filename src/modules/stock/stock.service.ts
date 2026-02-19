import prisma from "../../config/prisma";
import { tunoAiClient, wrapTunoAiError } from "../../config/tunoAiClient";
import { BadRequestError, NotFoundError } from "../../shared/errors/AppError";
import {
  unixTimestampToYyyymmdd,
  yyyymmddToUnixTimestamp,
} from "../../shared/utils/date";
import {
  toDomesticIndexMinuteCandle,
  toDomesticStockQuote,
  toOrderbook,
} from "./stock.utils";
import {
  DomesticIndexMinuteCandle,
  DomesticStockQuote,
  GetDomesticFinancialSummarySchema,
  GetIndexCandleSchema,
  GetIndexMinuteChartQuerySchema,
  GetStockCandleSchema,
  StockCandleItem,
  StockInfo,
  StockOrderbook,
  StockSearchResult,
  UpdateWatchlistOrderSchema,
} from "./stock.schema";


/** interval을 LS증권 period code로 변환하는 맵. */
const INTERVAL_TO_PERIOD: Record<string, string> = {
  "1d": "D",
  "1w": "W",
  "1m": "M",
  "1y": "Y",
};

/** 국내 주식 재무 요약을 조회한다. */
export const getDomesticFinancialSummaryService = async (
  stockCode: string,
  params: GetDomesticFinancialSummarySchema
) => {
  const { period, limit, order } = params;

  const financialSummaries = await prisma.domestic_financial_summary.findMany({
    where: {
      mksc_shrn_iscd: stockCode,
      ...(period && { fid_div_cls_code: period.toUpperCase() }),
    },
    orderBy: {
      stac_yymm: order,
    },
    take: limit,
  });

  return financialSummaries;
};

/** 국내 주식 마스터 정보를 조회한다. */
export const getStockMasterService = async (
  stockCode: string,
  exchange: "KP" | "KQ",
  userId?: number
): Promise<{ stockInfo: StockInfo; isInWatchlist?: boolean }> => {
  const stockMaster = await prisma.krx_stock_master.findFirst({
    where: {
      mksc_shrn_iscd: stockCode,
      market_code: exchange,
      scrt_grp_cls_code: { in: ["ST", "DR", "FS"] },
      deleted_at: null,
    },
  });

  if (!stockMaster) {
    throw new NotFoundError("종목 정보를 찾을 수 없습니다.");
  }

  const stockSummary = await prisma.krx_stock_summary.findUnique({
    where: { mksc_shrn_iscd: stockCode },
  });

  const stockInfo: StockInfo = {
    market: "KR",
    exchange,
    code: stockMaster.mksc_shrn_iscd.trim(),
    nameKo: stockMaster.hts_kor_isnm,
    nameEn: null,
    listedAt: stockMaster.stck_lstn_date?.trim() || null,
    isNxtInMaster: stockMaster.nxt_in_master,
    summary: stockSummary?.summary || null,
  };

  let isInWatchlist: boolean | undefined = undefined;
  if (userId !== undefined) {
    const watchlist = await prisma.stock_watch_list.findUnique({
      where: {
        user_id_exchange_code: {
          user_id: userId,
          exchange,
          code: stockInfo.code,
        },
      },
    });
    isInWatchlist = !!watchlist;
  }

  return { stockInfo, isInWatchlist };
};

/** 국내 주식 캔들 데이터를 조회한다. */
export const getStockCandleService = async (
  params: GetStockCandleSchema
): Promise<StockCandleItem[]> => {
  const { code, limit, from, to } = params;

  const isPeriodMode = from !== undefined && to !== undefined;
  const isScrollMode = to !== undefined && limit !== undefined;
  const isLimitOnly =
    limit !== undefined && from === undefined && to === undefined;

  const whereClause: any = {
    mksc_shrn_iscd: code,
  };

  if (isPeriodMode) {
    const fromDate = unixTimestampToYyyymmdd(from);
    const toDate = unixTimestampToYyyymmdd(to);
    whereClause.stck_bsop_date = {
      gte: fromDate,
      lte: toDate,
    };
  } else if (isScrollMode) {
    const toDate = unixTimestampToYyyymmdd(to);
    whereClause.stck_bsop_date = {
      lte: toDate,
    };
  }

  const needsDescOrder = isScrollMode || isLimitOnly;

  const domesticData = await prisma.stock_domestic_daily.findMany({
    where: whereClause,
    orderBy: {
      stck_bsop_date: needsDescOrder ? "desc" : "asc",
    },
    ...(needsDescOrder && { take: limit }),
  });

  // 내림차순으로 조회한 경우 시간순 정렬을 위해 역순 변환
  const sortedData = needsDescOrder
    ? [...domesticData].reverse()
    : domesticData;

  return sortedData.map(
    (item): StockCandleItem => ({
      time: yyyymmddToUnixTimestamp(item.stck_bsop_date),
      open: item.stck_oprc ? parseFloat(item.stck_oprc) : 0,
      high: item.stck_hgpr ? parseFloat(item.stck_hgpr) : 0,
      low: item.stck_lwpr ? parseFloat(item.stck_lwpr) : 0,
      close: item.stck_clpr ? parseFloat(item.stck_clpr) : 0,
      volume: item.acml_vol ? parseFloat(item.acml_vol) : 0,
      turnover: item.acml_tr_pbmn ? parseFloat(item.acml_tr_pbmn) : 0,
    })
  );
};

/** 국내 지수 캔들 데이터를 조회한다. */
export const getIndexCandleService = async (
  params: GetIndexCandleSchema
): Promise<StockCandleItem[]> => {
  const { code, interval, limit, from, to } = params;

  const periodDivCode = INTERVAL_TO_PERIOD[interval];

  const isPeriodMode = from !== undefined && to !== undefined;
  const isScrollMode = to !== undefined && limit !== undefined;
  const isLimitOnly =
    limit !== undefined && from === undefined && to === undefined;

  const whereClause: any = {
    bstp_cls_code: code,
    period_div_code: periodDivCode,
  };

  if (isPeriodMode) {
    const fromDate = unixTimestampToYyyymmdd(from);
    const toDate = unixTimestampToYyyymmdd(to);
    whereClause.stck_bsop_date = {
      gte: fromDate,
      lte: toDate,
    };
  } else if (isScrollMode) {
    const toDate = unixTimestampToYyyymmdd(to);
    whereClause.stck_bsop_date = {
      lte: toDate,
    };
  }

  const needsDescOrder = isScrollMode || isLimitOnly;

  const indexData = await prisma.domestic_bstp_period.findMany({
    where: whereClause,
    orderBy: {
      stck_bsop_date: needsDescOrder ? "desc" : "asc",
    },
    ...(needsDescOrder && { take: limit }),
  });

  const sortedData = needsDescOrder ? [...indexData].reverse() : indexData;

  return sortedData.map(
    (item): StockCandleItem => ({
      time: yyyymmddToUnixTimestamp(item.stck_bsop_date),
      open: item.bstp_nmix_oprc ? parseFloat(item.bstp_nmix_oprc) : 0,
      high: item.bstp_nmix_hgpr ? parseFloat(item.bstp_nmix_hgpr) : 0,
      low: item.bstp_nmix_lwpr ? parseFloat(item.bstp_nmix_lwpr) : 0,
      close: item.bstp_nmix_prpr ? parseFloat(item.bstp_nmix_prpr) : 0,
      volume: item.acml_vol ? parseFloat(item.acml_vol) : 0,
      turnover: item.acml_tr_pbmn ? parseFloat(item.acml_tr_pbmn) : 0,
    })
  );
};

/** 국내 지수 분봉 차트를 조회한다. */
export const getIndexMinuteChartService = async (
  industryCode: string,
  params: GetIndexMinuteChartQuerySchema
): Promise<DomesticIndexMinuteCandle[]> => {
  try {
    const { interval, include_past_data, exclude_after_hours } = params;

    const response = await tunoAiClient.get(
      `/api/v1/domestic-indices/${industryCode}/minute-chart`,
      {
        params: { interval, include_past_data, exclude_after_hours },
        timeout: 5000,
      }
    );

    return (response.data.output2 as any[]).map(toDomesticIndexMinuteCandle);
  } catch (error) {
    return wrapTunoAiError(error);
  }
};

/** 주식 현재가 시세를 조회한다. */
export const getStockQuoteService = async (
  stockCode: string,
  marketDivisionCode: string,
  periodType: string
): Promise<DomesticStockQuote> => {
  try {
    const response = await tunoAiClient.get(
      `/api/v1/domestic-stocks/${stockCode}/quote`,
      {
        params: { market_division_code: marketDivisionCode, period_type: periodType },
        timeout: 5000,
      }
    );

    return toDomesticStockQuote(response.data.output);
  } catch (error) {
    return wrapTunoAiError(error);
  }
};

/** 주식 호가를 조회한다. */
export const getOrderbookService = async (
  stockCode: string,
  marketDivisionCode: string
): Promise<StockOrderbook> => {
  try {
    const response = await tunoAiClient.get(
      `/api/v1/domestic-stocks/${stockCode}/orderbook`,
      {
        params: { market_division_code: marketDivisionCode },
        timeout: 5000,
      }
    );

    return toOrderbook(response.data.output1);
  } catch (error) {
    return wrapTunoAiError(error);
  }
};

/** 국내 주식을 검색한다. */
export const searchStocksService = async (
  q: string,
  limit?: number
): Promise<StockSearchResult[]> => {
  const domesticStocks = await prisma.krx_stock_master.findMany({
    where: {
      OR: [
        { hts_kor_isnm: { startsWith: q } },
        { mksc_shrn_iscd: { startsWith: q } },
      ],
      scrt_grp_cls_code: { in: ["ST", "DR", "FS"] },
      deleted_at: null,
    },
    take: limit,
    orderBy: { hts_kor_isnm: "asc" },
  });

  return domesticStocks.map(
    (stock): StockSearchResult => ({
      type: "domestic",
      market: "KR",
      exchange: stock.market_code as "KP" | "KQ",
      code: stock.mksc_shrn_iscd,
      nameKo: stock.hts_kor_isnm,
      nameEn: null,
      listedAt: null,
      isNxtInMaster: null,
    })
  );
};

/** 관심종목을 추가하거나 제거한다. */
export const toggleWatchlistService = async (
  userId: number,
  stockCode: string,
  exchange: "KP" | "KQ"
): Promise<{ isInWatchlist: boolean }> => {
  const stockMaster = await prisma.krx_stock_master.findFirst({
    where: {
      mksc_shrn_iscd: stockCode,
      market_code: exchange,
      scrt_grp_cls_code: { in: ["ST", "DR", "FS"] },
      deleted_at: null,
    },
  });

  if (!stockMaster) {
    throw new NotFoundError("종목을 찾을 수 없습니다.");
  }

  return prisma.$transaction(async (tx) => {
    const existingWatchlist = await tx.stock_watch_list.findUnique({
      where: {
        user_id_exchange_code: {
          user_id: userId,
          exchange,
          code: stockCode,
        },
      },
    });

    if (existingWatchlist) {
      await tx.stock_watch_list.delete({
        where: {
          user_id_exchange_code: {
            user_id: userId,
            exchange,
            code: stockCode,
          },
        },
      });

      return { isInWatchlist: false };
    } else {
      const currentCount = await tx.stock_watch_list.count({
        where: { user_id: userId },
      });

      if (currentCount >= 100) {
        throw new BadRequestError(
          "관심종목은 최대 100개까지 추가할 수 있습니다."
        );
      }

      await tx.stock_watch_list.create({
        data: {
          user_id: userId,
          exchange,
          code: stockCode,
        },
      });

      return { isInWatchlist: true };
    }
  });
};

/** 관심종목 목록을 조회한다. */
export const getWatchlistService = async (
  userId: number,
  exchange?: "KP" | "KQ"
): Promise<{ count: number; items: StockInfo[] }> => {
  const watchlistItems = await prisma.stock_watch_list.findMany({
    where: {
      user_id: userId,
      exchange: exchange ?? { in: ["KP", "KQ"] },
    },
    orderBy: {
      sort_order: "asc",
    },
  });

  if (watchlistItems.length === 0) {
    return { count: 0, items: [] };
  }

  const domesticGroups: Record<string, string[]> = {};

  for (const item of watchlistItems) {
    if (!domesticGroups[item.exchange]) {
      domesticGroups[item.exchange] = [];
    }
    domesticGroups[item.exchange].push(item.code);
  }

  const stockMasterMap = new Map<string, any>();

  for (const [exch, codes] of Object.entries(domesticGroups)) {
    if (codes.length > 0) {
      const masters = await prisma.krx_stock_master.findMany({
        where: {
          mksc_shrn_iscd: { in: codes },
          market_code: exch,
          scrt_grp_cls_code: { in: ["ST", "DR", "FS"] },
          deleted_at: null,
        },
      });

      for (const master of masters) {
        const key = `${exch}:${master.mksc_shrn_iscd.trim()}`;
        stockMasterMap.set(key, master);
      }
    }
  }

  const stockInfos: StockInfo[] = [];

  for (const item of watchlistItems) {
    const key = `${item.exchange}:${item.code}`;
    const stockMaster = stockMasterMap.get(key);

    if (!stockMaster) {
      continue;
    }

    stockInfos.push({
      market: "KR",
      exchange: item.exchange as "KP" | "KQ",
      code: stockMaster.mksc_shrn_iscd.trim(),
      nameKo: stockMaster.hts_kor_isnm,
      nameEn: null,
      listedAt: stockMaster.stck_lstn_date?.trim() || null,
      isNxtInMaster: stockMaster.nxt_in_master,
    });
  }

  return { count: stockInfos.length, items: stockInfos };
};

/** 관심종목을 전체 삭제한다. */
export const deleteAllWatchlistService = async (
  userId: number
): Promise<{ deletedCount: number }> => {
  const result = await prisma.stock_watch_list.deleteMany({
    where: { user_id: userId },
  });

  return { deletedCount: result.count };
};

/** 관심종목 순서를 변경한다. */
export const updateWatchlistOrderService = async (
  userId: number,
  order: UpdateWatchlistOrderSchema["order"]
): Promise<{ count: number; invalidItems?: Array<{ exchange: string; code: string }> }> => {
  const watchlistItems = await prisma.stock_watch_list.findMany({
    where: { user_id: userId },
    select: { exchange: true, code: true },
  });

  const watchlistMap = new Map<string, boolean>();
  for (const item of watchlistItems) {
    const key = `${item.exchange}:${item.code}`;
    watchlistMap.set(key, true);
  }

  const invalidItems: Array<{ exchange: string; code: string }> = [];
  for (const item of order) {
    const key = `${item.exchange}:${item.code}`;
    if (!watchlistMap.has(key)) {
      invalidItems.push(item);
    }
  }

  if (invalidItems.length > 0) {
    throw new BadRequestError("관심종목에 없는 종목이 포함되어 있습니다.", {
      invalidItems,
    });
  }

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < order.length; i++) {
      const item = order[i];
      await tx.stock_watch_list.update({
        where: {
          user_id_exchange_code: {
            user_id: userId,
            exchange: item.exchange,
            code: item.code,
          },
        },
        data: {
          sort_order: i + 1,
        },
      });
    }
  });

  return { count: order.length };
};

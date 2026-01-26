import { NextFunction, Request, Response } from "express";
import { handleTunoAiAxiosError, tunoAiClient } from "../config/tunoAiClient";
import prisma from "../config/prisma";
import {
  GetDomesticFinancialSummarySchema,
  GetDomesticStockQuoteSchema,
  GetStockCandleSchema,
  GetStockMasterSchema,
  GetWatchlistSchema,
  SearchStockSchema,
  ToggleWatchlistSchema,
  UpdateWatchlistOrderSchema,
} from "../schema/stock.schema";
import { StockCandleItem, StockInfo, StockSearchResult } from "../types/stock";
import { sendError, sendSuccess } from "../utils/commonResponse";
import {
  unixTimestampToYyyymmdd,
  yyyymmddToUnixTimestamp,
} from "../utils/date";
import { toDomesticStockQuote } from "../utils/stock";
import { UserPayload } from "../utils/token";

// 관심종목 한계 초과 에러
class WatchlistLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WatchlistLimitError";
  }
}

// 국내 주식 재무 요약 조회
export const getDomesticFinancialSummary = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const stockCode = req.validated?.params?.code as string;
    const queryParams = req.validated
      ?.query as GetDomesticFinancialSummarySchema;

    const period = queryParams?.period;
    const limit = queryParams?.limit;
    const order = queryParams?.order;

    // 데이터 조회
    const financialSummaries = await prisma.domestic_financial_summary.findMany(
      {
        where: {
          mksc_shrn_iscd: stockCode,
          ...(period && { fid_div_cls_code: period.toUpperCase() }),
        },
        orderBy: {
          stac_yymm: order,
        },
        take: limit,
      }
    );

    return sendSuccess(
      res,
      200,
      "재무 요약 정보를 조회했습니다.",
      financialSummaries
    );
  } catch (error) {
    next(error);
  }
};

// 주식 마스터 조회 (국내/해외 통합)
export const getStockMaster = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const stockCode = req.validated?.params?.code as string;
    const { market, exchange } = req.validated?.query as GetStockMasterSchema;
    const currentUserId = (req.user as UserPayload)?.userId ?? undefined;

    let stockInfo: StockInfo | null = null;

    if (market === "KR") {
      // 국내 주식 마스터 조회 (ST: 주식, DR: DR, FS: 외국주권만)
      const stockMaster = await prisma.krx_stock_master.findFirst({
        where: {
          mksc_shrn_iscd: stockCode,
          market_code: exchange, // KP, KQ
          scrt_grp_cls_code: { in: ["ST", "DR", "FS"] },
          deleted_at: null,
        },
      });

      if (stockMaster) {
        // 기업개요 조회
        const stockSummary = await prisma.krx_stock_summary.findUnique({
          where: { mksc_shrn_iscd: stockCode },
        });

        stockInfo = {
          market: "KR",
          exchange: exchange as "KP" | "KQ",
          code: stockMaster.mksc_shrn_iscd.trim(),
          nameKo: stockMaster.hts_kor_isnm,
          nameEn: null, // 국내 주식은 영문명 없음
          listedAt: stockMaster.stck_lstn_date?.trim() || null,
          isNxtInMaster: stockMaster.nxt_in_master,
          summary: stockSummary?.summary || null,
        };
      }
    } else {
      // 해외 주식 마스터 조회 (stis=2: 주식만)
      const stockMaster = await prisma.foreign_stock_master.findFirst({
        where: {
          symb: stockCode,
          excd: exchange, // NAS, NYS, AMS
          stis: "2",
          deleted_at: null,
        },
      });

      if (stockMaster) {
        stockInfo = {
          market: "US",
          exchange: exchange as "NAS" | "NYS" | "AMS",
          code: stockMaster.symb.trim(),
          nameKo: stockMaster.knam,
          nameEn: stockMaster.enam,
          listedAt: null, // 해외 주식은 상장일자 없음
          isNxtInMaster: null,
        };
      }
    }

    if (!stockInfo) {
      return sendError(res, 404, "종목 정보를 찾을 수 없습니다.");
    }

    // 관심종목 여부 확인 (로그인한 경우에만)
    let isInWatchlist: boolean | undefined = undefined;
    if (currentUserId !== undefined) {
      const watchlist = await prisma.stock_watch_list.findUnique({
        where: {
          user_id_exchange_code: {
            user_id: currentUserId,
            exchange: stockInfo.exchange,
            code: stockInfo.code,
          },
        },
      });
      isInWatchlist = !!watchlist;
    }

    return sendSuccess(res, 200, "종목 정보를 조회했습니다.", {
      ...stockInfo,
      isInWatchlist,
    } as StockInfo);
  } catch (error) {
    next(error);
  }
};

// 주식 캔들 데이터 조회
export const getStockCandle = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { market, exchange, code, interval, limit, from, to } = req.validated
      ?.query as GetStockCandleSchema;

    // interval 검증 (현재는 1d만 지원)
    if (interval !== "1d") {
      return sendError(res, 400, "현재는 일봉(1d)만 지원됩니다.");
    }

    // 날짜 범위 처리
    const isPeriodMode = from !== undefined && to !== undefined;
    const isScrollMode = to !== undefined && limit !== undefined;
    const isLimitOnly =
      limit !== undefined && from === undefined && to === undefined;

    let candles: StockCandleItem[] = [];

    if (market === "KR") {
      // 국내 주식 조회
      const whereClause: any = {
        mksc_shrn_iscd: code,
      };

      // 날짜 범위 필터링
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
      // isLimitOnly인 경우 날짜 조건 없이 최신 데이터부터 가져옴

      const needsDescOrder = isScrollMode || isLimitOnly;

      const domesticData = await prisma.stock_domestic_daily.findMany({
        where: whereClause,
        orderBy: {
          stck_bsop_date: needsDescOrder ? "desc" : "asc",
        },
        ...(needsDescOrder && { take: limit }),
      });

      // 내림차순으로 가져온 경우 역순으로 정렬 (시간순 정렬)
      const sortedData = needsDescOrder
        ? [...domesticData].reverse()
        : domesticData;

      candles = sortedData.map(
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
    } else {
      // 해외 주식 조회
      const whereClause: any = {
        excd: exchange,
        symb: code,
      };

      // 날짜 범위 필터링
      if (isPeriodMode) {
        const fromDate = unixTimestampToYyyymmdd(from);
        const toDate = unixTimestampToYyyymmdd(to);
        whereClause.xymd = {
          gte: fromDate,
          lte: toDate,
        };
      } else if (isScrollMode) {
        const toDate = unixTimestampToYyyymmdd(to);
        whereClause.xymd = {
          lte: toDate,
        };
      }
      // isLimitOnly인 경우 날짜 조건 없이 최신 데이터부터 가져옴

      const needsDescOrder = isScrollMode || isLimitOnly;

      const overseasData = await prisma.stock_overseas_daily.findMany({
        where: whereClause,
        orderBy: {
          xymd: needsDescOrder ? "desc" : "asc",
        },
        ...(needsDescOrder && { take: limit }),
      });

      // 내림차순으로 가져온 경우 역순으로 정렬 (시간순 정렬)
      const sortedData = needsDescOrder
        ? [...overseasData].reverse()
        : overseasData;

      candles = sortedData.map(
        (item): StockCandleItem => ({
          time: yyyymmddToUnixTimestamp(item.xymd),
          open: item.open ? parseFloat(item.open) : 0,
          high: item.high ? parseFloat(item.high) : 0,
          low: item.low ? parseFloat(item.low) : 0,
          close: item.clos ? parseFloat(item.clos) : 0,
          volume: item.tvol ? parseFloat(item.tvol) : 0,
          turnover: item.tamt ? parseFloat(item.tamt) : 0,
        })
      );
    }

    return sendSuccess(res, 200, "주가 캔들 데이터를 조회했습니다.", {
      market,
      code,
      interval,
      count: candles.length,
      candles,
    });
  } catch (error) {
    next(error);
  }
};

// 주식현재가 시세[v1_국내주식-008] 조회 (tuno-ai 프록시)
export const getStockQuote = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const stockCode = req.validated?.params?.code as string;
    const { market_division_code, period_type } = req.validated
      ?.query as GetDomesticStockQuoteSchema;
    // tuno-ai 서버로 요청
    const response = await tunoAiClient.get(
      `/api/v1/domestic-stocks/${stockCode}/quote`,
      {
        params: { market_division_code, period_type },
        timeout: 5000, // 5초 타임아웃
      }
    );
    const data = toDomesticStockQuote(response.data.output);

    return sendSuccess(res, 200, "주식 현재가 시세를 조회했습니다.", data);
  } catch (error) {
    if (handleTunoAiAxiosError(res, error)) return;
    next(error);
  }
};

// 주식 검색
export const searchStocks = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { q, type, limit } = req.validated?.query as SearchStockSchema;

    const results: StockSearchResult[] = [];

    // 국내 주식 검색
    if (type !== "overseas") {
      const domesticStocks = await prisma.krx_stock_master.findMany({
        where: {
          OR: [
            { hts_kor_isnm: { startsWith: q } }, // 한글 종목명 포함
            { mksc_shrn_iscd: { startsWith: q } }, // 종목코드로 시작
          ],
          scrt_grp_cls_code: { in: ["ST", "DR", "FS"] }, // 주식만
          deleted_at: null,
        },
        take: limit,
        orderBy: { hts_kor_isnm: "asc" },
      });

      // 결과를 StockSearchResult 형태로 변환
      const domesticResults: StockSearchResult[] = domesticStocks.map(
        (stock) => ({
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

      results.push(...domesticResults);
    }

    // // 해외 주식 검색 (현재 지원 안함)
    // if (type !== "domestic") {
    //   const remainingLimit = limit - results.length;
    //   if (remainingLimit > 0) {
    //     const foreignStocks = await prisma.foreign_stock_master.findMany({
    //       where: {
    //         OR: [
    //           { knam: { contains: q } }, // 한글명 포함
    //           { enam: { contains: q } }, // 영문명 포함
    //           { symb: { startsWith: q } }, // 심볼로 시작
    //         ],
    //         stis: "2", // 주식만
    //       },
    //       take: remainingLimit,
    //     });

    //     // 결과를 StockSearchResult 형태로 변환
    //     const foreignResults: StockSearchResult[] = foreignStocks.map(
    //       (stock) => ({
    //         type: "foreign",
    //         market: "US",
    //         exchange: stock.excd as "NAS" | "NYS" | "AMS",
    //         code: stock.symb.trim(),
    //         nameKo: stock.knam,
    //         nameEn: stock.enam,
    //         listedAt: null,
    //         isNxtInMaster: null,
    //       })
    //     );

    //     results.push(...foreignResults);
    //   }
    // }

    return sendSuccess(res, 200, "주식 검색 결과를 조회했습니다.", {
      query: q,
      count: results.length,
      results,
    });
  } catch (error) {
    next(error);
  }
};

// 관심종목 추가/제거 (토글)
export const toggleWatchlist = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.user as UserPayload;
    const stockCode = req.validated?.params?.code as string;
    const { exchange } = req.validated?.query as ToggleWatchlistSchema;

    // exchange로 market 판단
    const isDomestic = exchange === "KP" || exchange === "KQ";

    // 종목 존재 여부 및 삭제 여부 확인
    let stockExists = false;
    if (isDomestic) {
      // 국내 주식 마스터 확인
      const stockMaster = await prisma.krx_stock_master.findFirst({
        where: {
          mksc_shrn_iscd: stockCode,
          market_code: exchange,
          scrt_grp_cls_code: { in: ["ST", "DR", "FS"] },
          deleted_at: null,
        },
      });
      stockExists = !!stockMaster;
    } else {
      // 해외 주식 마스터 확인
      const stockMaster = await prisma.foreign_stock_master.findFirst({
        where: {
          symb: stockCode,
          excd: exchange,
          stis: "2",
          deleted_at: null,
        },
      });
      stockExists = !!stockMaster;
    }

    if (!stockExists) {
      return sendError(res, 404, "종목을 찾을 수 없습니다.");
    }

    // 트랜잭션으로 관심종목 추가/제거
    const result = await prisma.$transaction(async (tx) => {
      // 트랜잭션 안에서 현재 사용자의 관심종목 존재 여부 확인
      const existingWatchlist = await tx.stock_watch_list.findUnique({
        where: {
          user_id_exchange_code: {
            user_id: userId,
            exchange: exchange,
            code: stockCode,
          },
        },
      });

      if (existingWatchlist) {
        // 관심종목 제거
        await tx.stock_watch_list.delete({
          where: {
            user_id_exchange_code: {
              user_id: userId,
              exchange: exchange,
              code: stockCode,
            },
          },
        });

        return {
          isInWatchlist: false,
        };
      } else {
        // 관심종목 추가 전에 100개 한계 체크
        const currentCount = await tx.stock_watch_list.count({
          where: {
            user_id: userId,
          },
        });

        if (currentCount >= 100) {
          throw new WatchlistLimitError(
            "관심종목은 최대 100개까지 추가할 수 있습니다."
          );
        }

        // 관심종목 추가
        await tx.stock_watch_list.create({
          data: {
            user_id: userId,
            exchange: exchange,
            code: stockCode,
          },
        });

        return {
          isInWatchlist: true,
        };
      }
    });

    return sendSuccess(
      res,
      200,
      result.isInWatchlist
        ? "관심종목에 추가되었습니다."
        : "관심종목에서 제거되었습니다.",
      result
    );
  } catch (error) {
    // 100개 한계 초과 에러 처리
    if (error instanceof WatchlistLimitError) {
      return sendError(res, 400, error.message);
    }
    next(error);
  }
};

// 관심종목 목록 조회
export const getWatchlist = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.user as UserPayload;
    const { exchange } = req.validated?.query as GetWatchlistSchema;

    // 1. 관심종목 목록 조회
    const watchlistItems = await prisma.stock_watch_list.findMany({
      where: {
        user_id: userId,
        ...(exchange && { exchange }),
      },
      orderBy: {
        sort_order: "asc",
      },
    });

    if (watchlistItems.length === 0) {
      return sendSuccess(res, 200, "관심종목 목록을 조회했습니다.", {
        count: 0,
        items: [],
      });
    }

    // 2. exchange별로 그룹화
    const domesticGroups: Record<string, string[]> = {}; // { "KP": ["005930", ...], "KQ": [...] }
    const foreignGroups: Record<string, string[]> = {}; // { "NAS": ["AAPL", ...], ... }
    const watchlistMap = new Map<string, (typeof watchlistItems)[0]>(); // code+exchange -> watchlist item

    for (const item of watchlistItems) {
      const key = `${item.exchange}:${item.code}`;
      watchlistMap.set(key, item);

      if (item.exchange === "KP" || item.exchange === "KQ") {
        if (!domesticGroups[item.exchange]) {
          domesticGroups[item.exchange] = [];
        }
        domesticGroups[item.exchange].push(item.code);
      } else {
        if (!foreignGroups[item.exchange]) {
          foreignGroups[item.exchange] = [];
        }
        foreignGroups[item.exchange].push(item.code);
      }
    }

    // 3. 배치로 마스터 정보 조회
    const stockMasterMap = new Map<string, any>(); // code+exchange -> stock master

    // 국내 주식 배치 조회
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

    // 해외 주식 배치 조회
    for (const [exch, codes] of Object.entries(foreignGroups)) {
      if (codes.length > 0) {
        const masters = await prisma.foreign_stock_master.findMany({
          where: {
            symb: { in: codes },
            excd: exch,
            stis: "2",
            deleted_at: null,
          },
        });

        for (const master of masters) {
          const key = `${exch}:${master.symb.trim()}`;
          stockMasterMap.set(key, master);
        }
      }
    }

    // 4. 결과 조합
    const stockInfos: StockInfo[] = [];

    for (const item of watchlistItems) {
      const key = `${item.exchange}:${item.code}`;
      const stockMaster = stockMasterMap.get(key);

      if (!stockMaster) {
        // 삭제된 종목은 제외
        continue;
      }

      const isDomestic = item.exchange === "KP" || item.exchange === "KQ";
      let stockInfo: StockInfo;

      if (isDomestic) {
        stockInfo = {
          market: "KR",
          exchange: item.exchange as "KP" | "KQ",
          code: stockMaster.mksc_shrn_iscd.trim(),
          nameKo: stockMaster.hts_kor_isnm,
          nameEn: null,
          listedAt: stockMaster.stck_lstn_date?.trim() || null,
          isNxtInMaster: stockMaster.nxt_in_master,
        };
      } else {
        stockInfo = {
          market: "US",
          exchange: item.exchange as "NAS" | "NYS" | "AMS",
          code: stockMaster.symb.trim(),
          nameKo: stockMaster.knam,
          nameEn: stockMaster.enam,
          listedAt: null,
          isNxtInMaster: null,
        };
      }

      stockInfos.push(stockInfo);
    }

    return sendSuccess(res, 200, "관심종목 목록을 조회했습니다.", {
      count: stockInfos.length,
      items: stockInfos,
    });
  } catch (error) {
    next(error);
  }
};

// 관심종목 전체 삭제
export const deleteAllWatchlist = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.user as UserPayload;

    const result = await prisma.stock_watch_list.deleteMany({
      where: {
        user_id: userId,
      },
    });

    return sendSuccess(res, 200, "관심종목이 전체 삭제되었습니다.", {
      deletedCount: result.count,
    });
  } catch (error) {
    next(error);
  }
};

// 관심종목 순서 변경
export const updateWatchlistOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.user as UserPayload;
    const { order } = req.validated?.body as UpdateWatchlistOrderSchema;

    // 1. 사용자의 관심종목인지 검증
    const watchlistItems = await prisma.stock_watch_list.findMany({
      where: {
        user_id: userId,
      },
      select: {
        exchange: true,
        code: true,
      },
    });

    // 관심종목을 Map으로 변환 (빠른 검색)
    const watchlistMap = new Map<string, boolean>();
    for (const item of watchlistItems) {
      const key = `${item.exchange}:${item.code}`;
      watchlistMap.set(key, true);
    }

    // 요청된 항목들이 모두 사용자의 관심종목인지 확인
    const invalidItems: Array<{ exchange: string; code: string }> = [];
    for (const item of order) {
      const key = `${item.exchange}:${item.code}`;
      if (!watchlistMap.has(key)) {
        invalidItems.push(item);
      }
    }

    if (invalidItems.length > 0) {
      return sendError(res, 400, "관심종목에 없는 종목이 포함되어 있습니다.", {
        invalidItems,
      });
    }

    // 2. 순서대로 sort_order 재정렬 (1, 2, 3...)
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

    return sendSuccess(res, 200, "관심종목 순서가 변경되었습니다.", {
      count: order.length,
    });
  } catch (error) {
    next(error);
  }
};

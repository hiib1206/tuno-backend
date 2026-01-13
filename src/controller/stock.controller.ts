import axios from "axios";
import { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import prisma from "../config/prisma";
import {
  GetDomesticFinancialSummarySchema,
  GetDomesticStockQuoteSchema,
  GetStockCandleSchema,
  GetStockMasterSchema,
  SearchStockSchema,
} from "../schema/stock.schema";
import { StockCandleItem, StockInfo, StockSearchResult } from "../types/stock";
import { sendError, sendSuccess } from "../utils/commonResponse";
import {
  unixTimestampToYyyymmdd,
  yyyymmddToUnixTimestamp,
} from "../utils/date";
import { toDomesticStockQuote } from "../utils/stock";

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
        stockInfo = {
          market: "KR",
          exchange: exchange as "KP" | "KQ",
          code: stockMaster.mksc_shrn_iscd.trim(),
          nameKo: stockMaster.hts_kor_isnm,
          nameEn: null, // 국내 주식은 영문명 없음
          listedAt: stockMaster.stck_lstn_date?.trim() || null,
          isNxtInMaster: stockMaster.nxt_in_master,
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

    return sendSuccess(res, 200, "종목 정보를 조회했습니다.", stockInfo);
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
    const response = await axios.get(
      `${env.TUNO_AI_API_BASE_URL}/api/v1/domestic-stocks/${stockCode}/quote`,
      {
        params: { market_division_code, period_type },
        timeout: 5000, // 5초 타임아웃
        headers: {
          "x-internal-secret-key": env.TUNO_AI_API_SECRET_KEY,
        },
      }
    );
    const data = toDomesticStockQuote(response.data.output);

    return sendSuccess(res, 200, "주식 현재가 시세를 조회했습니다.", data);
  } catch (error) {
    // Axios 에러 처리
    if (axios.isAxiosError(error)) {
      if (error.response) {
        // FastAPI에서 온 에러 응답 (400, 422, 502 등)
        return sendError(
          res,
          error.response.status,
          error.response.data?.message || "tuno-ai 서버 오류"
        );
      } else if (error.code === "ECONNABORTED") {
        // 타임아웃
        return sendError(res, 504, "tuno-ai 서버 응답 시간 초과");
      } else {
        // 네트워크 에러 (연결 실패)
        return sendError(res, 502, "tuno-ai 서버 연결 실패");
      }
    }

    // 기타 에러
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

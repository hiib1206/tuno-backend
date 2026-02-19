import { Request, Response } from "express";
import { BadRequestError } from "../../shared/errors/AppError";
import { sendSuccess } from "../../shared/utils/commonResponse";
import { UserPayload } from "../../shared/utils/token";
import {
  GetDomesticFinancialSummarySchema,
  GetDomesticStockQuoteSchema,
  GetIndexCandleSchema,
  GetIndexMinuteChartQuerySchema,
  GetIndexPriceParamsSchema,
  GetOrderbookSchema,
  GetStockCandleSchema,
  GetStockMasterSchema,
  GetWatchlistSchema,
  SearchStockSchema,
  ToggleWatchlistSchema,
  UpdateWatchlistOrderSchema,
} from "./stock.schema";
import {
  deleteAllWatchlistService,
  getDomesticFinancialSummaryService,
  getIndexCandleService,
  getIndexMinuteChartService,
  getOrderbookService,
  getStockCandleService,
  getStockMasterService,
  getStockQuoteService,
  getWatchlistService,
  searchStocksService,
  toggleWatchlistService,
  updateWatchlistOrderService,
} from "./stock.service";

/** 국내 주식 재무 요약을 조회한다. */
export const getDomesticFinancialSummary = async (req: Request, res: Response) => {
  const stockCode = req.validated?.params?.code as string;
  const queryParams = req.validated?.query as GetDomesticFinancialSummarySchema;

  const data = await getDomesticFinancialSummaryService(stockCode, queryParams);

  return sendSuccess(res, 200, "재무 요약 정보를 조회했습니다.", data);
};

/** 국내 주식 마스터 정보를 조회한다. */
export const getStockMaster = async (req: Request, res: Response) => {
  const stockCode = req.validated?.params?.code as string;
  const { exchange } = req.validated?.query as GetStockMasterSchema;
  const currentUserId = (req.user as UserPayload)?.userId ?? undefined;

  const result = await getStockMasterService(stockCode, exchange, currentUserId);

  return sendSuccess(res, 200, "종목 정보를 조회했습니다.", {
    ...result.stockInfo,
    isInWatchlist: result.isInWatchlist,
  });
};

/** 국내 주식 캔들 데이터를 조회한다. */
export const getStockCandle = async (req: Request, res: Response) => {
  const params = req.validated?.query as GetStockCandleSchema;

  if (params.interval !== "1d") {
    throw new BadRequestError("현재는 일봉(1d)만 지원됩니다.");
  }

  const candles = await getStockCandleService(params);

  return sendSuccess(res, 200, "주가 캔들 데이터를 조회했습니다.", {
    market: params.market,
    code: params.code,
    interval: params.interval,
    count: candles.length,
    candles,
  });
};

/** 국내 지수 캔들 데이터를 조회한다. */
export const getIndexCandle = async (req: Request, res: Response) => {
  const params = req.validated?.query as GetIndexCandleSchema;

  const candles = await getIndexCandleService(params);

  return sendSuccess(res, 200, "지수 캔들 데이터를 조회했습니다.", {
    code: params.code,
    interval: params.interval,
    count: candles.length,
    candles,
  });
};

/** 국내 지수 분봉 차트를 조회한다. */
export const getIndexMinuteChart = async (req: Request, res: Response) => {
  const { industryCode } = req.validated?.params as GetIndexPriceParamsSchema;
  const queryParams = req.validated?.query as GetIndexMinuteChartQuerySchema;

  const data = await getIndexMinuteChartService(industryCode, queryParams);

  return sendSuccess(res, 200, "국내 지수 분봉 차트를 조회했습니다.", data);
};

/** 주식 현재가 시세를 조회한다. */
export const getStockQuote = async (req: Request, res: Response) => {
  const stockCode = req.validated?.params?.code as string;
  const { market_division_code, period_type } = req.validated
    ?.query as GetDomesticStockQuoteSchema;

  const data = await getStockQuoteService(stockCode, market_division_code, period_type);

  return sendSuccess(res, 200, "주식 현재가 시세를 조회했습니다.", data);
};

/** 주식 호가를 조회한다. */
export const getOrderbook = async (req: Request, res: Response) => {
  const stockCode = req.validated?.params?.code as string;
  const { market_division_code } = req.validated?.query as GetOrderbookSchema;

  const data = await getOrderbookService(stockCode, market_division_code);

  return sendSuccess(res, 200, "주식 호가를 조회했습니다.", data, {
    skipCamelCase: true,
  });
};

/** 국내 주식을 검색한다. */
export const searchStocks = async (req: Request, res: Response) => {
  const { q, limit } = req.validated?.query as SearchStockSchema;

  const results = await searchStocksService(q, limit);

  return sendSuccess(res, 200, "주식 검색 결과를 조회했습니다.", {
    query: q,
    count: results.length,
    results,
  });
};

/** 관심종목을 추가하거나 제거한다. */
export const toggleWatchlist = async (req: Request, res: Response) => {
  const { userId } = req.user as UserPayload;
  const stockCode = req.validated?.params?.code as string;
  const { exchange } = req.validated?.query as ToggleWatchlistSchema;

  const result = await toggleWatchlistService(userId, stockCode, exchange);

  return sendSuccess(
    res,
    200,
    result.isInWatchlist
      ? "관심종목에 추가되었습니다."
      : "관심종목에서 제거되었습니다.",
    result
  );
};

/** 관심종목 목록을 조회한다. */
export const getWatchlist = async (req: Request, res: Response) => {
  const { userId } = req.user as UserPayload;
  const { exchange } = req.validated?.query as GetWatchlistSchema;

  const data = await getWatchlistService(userId, exchange);

  return sendSuccess(res, 200, "관심종목 목록을 조회했습니다.", data);
};

/** 관심종목을 전체 삭제한다. */
export const deleteAllWatchlist = async (req: Request, res: Response) => {
  const { userId } = req.user as UserPayload;

  const data = await deleteAllWatchlistService(userId);

  return sendSuccess(res, 200, "관심종목이 전체 삭제되었습니다.", data);
};

/** 관심종목 순서를 변경한다. */
export const updateWatchlistOrder = async (req: Request, res: Response) => {
  const { userId } = req.user as UserPayload;
  const { order } = req.validated?.body as UpdateWatchlistOrderSchema;

  const result = await updateWatchlistOrderService(userId, order);

  return sendSuccess(res, 200, "관심종목 순서가 변경되었습니다.", {
    count: result.count,
  });
};

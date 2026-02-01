import { Router } from "express";
import {
  deleteAllWatchlist,
  getDomesticFinancialSummary,
  getIndexCandle,
  getOrderbook,
  getStockCandle,
  getStockMaster,
  getStockQuote,
  getWatchlist,
  searchStocks,
  toggleWatchlist,
  updateWatchlistOrder,
} from "../controller/stock.controller";
import {
  optionalVerifyAccessTokenMiddleware,
  verifyAccessTokenMiddleware,
} from "../middleware/auth.middleware";
import { validateMiddleware } from "../middleware/validation.middleware";
import {
  getDomesticFinancialSummarySchema,
  getDomesticStockQuoteSchema,
  getIndexCandleSchema,
  getOrderbookSchema,
  getStockCandleSchema,
  getStockCodeSchema,
  getStockMasterSchema,
  getWatchlistSchema,
  searchStockSchema,
  toggleWatchlistSchema,
  updateWatchlistOrderSchema,
} from "../schema/stock.schema";

const stockRouter = Router();

// GET /api/stock/candle?market=KR&exchange=KP&code=005930&interval=1d&to=1704441900&limit=250
stockRouter.get(
  "/candle",
  validateMiddleware({
    query: getStockCandleSchema,
  }),
  getStockCandle
);

// GET /api/stock/index/candle?code=0001&interval=1d&limit=250
stockRouter.get(
  "/index/candle",
  validateMiddleware({
    query: getIndexCandleSchema,
  }),
  getIndexCandle
);

// GET /api/stock/search?q=삼성&type=all&limit=10
stockRouter.get(
  "/search",
  validateMiddleware({
    query: searchStockSchema,
  }),
  searchStocks
);

// GET /api/stock/watchlist?exchange=KP
stockRouter.get(
  "/watchlist",
  verifyAccessTokenMiddleware,
  validateMiddleware({
    query: getWatchlistSchema,
  }),
  getWatchlist
);

// PATCH /api/stock/watchlist/order
stockRouter.patch(
  "/watchlist/order",
  verifyAccessTokenMiddleware,
  validateMiddleware({
    body: updateWatchlistOrderSchema,
  }),
  updateWatchlistOrder
);

// DELETE /api/stock/watchlist - 전체 관심종목 삭제
stockRouter.delete(
  "/watchlist",
  verifyAccessTokenMiddleware,
  deleteAllWatchlist
);

// GET /api/stock/005930/quote?market_division_code=UN&period_type=D
stockRouter.get(
  "/:code/quote",
  validateMiddleware({
    params: getStockCodeSchema,
    query: getDomesticStockQuoteSchema,
  }),
  getStockQuote
);

// GET /api/stock/005930/orderbook?market_division_code=J
stockRouter.get(
  "/:code/orderbook",
  validateMiddleware({
    params: getStockCodeSchema,
    query: getOrderbookSchema,
  }),
  getOrderbook
);

// GET /api/stock/:code/financials?period=y&limit=4&order=desc
stockRouter.get(
  "/:code/financials",
  validateMiddleware({
    params: getStockCodeSchema,
    query: getDomesticFinancialSummarySchema,
  }),
  getDomesticFinancialSummary
);

// GET /api/stock/:code?market=KR&exchange=KP
stockRouter.get(
  "/:code",
  optionalVerifyAccessTokenMiddleware,
  validateMiddleware({
    params: getStockCodeSchema,
    query: getStockMasterSchema,
  }),
  getStockMaster
);

// POST /api/stock/:code/watchlist?exchange=KP
stockRouter.post(
  "/:code/watchlist",
  verifyAccessTokenMiddleware,
  validateMiddleware({
    params: getStockCodeSchema,
    query: toggleWatchlistSchema,
  }),
  toggleWatchlist
);

export default stockRouter;

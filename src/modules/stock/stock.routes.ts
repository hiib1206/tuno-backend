import { Router } from "express";
import {
  optionalVerifyAccessTokenMiddleware,
  verifyAccessTokenMiddleware,
} from "../../middleware/auth.middleware";
import { validateMiddleware } from "../../middleware/validation.middleware";
import {
  deleteAllWatchlist,
  getDomesticFinancialSummary,
  getIndexCandle,
  getIndexMinuteChart,
  getOrderbook,
  getStockCandle,
  getStockMaster,
  getStockQuote,
  getWatchlist,
  searchStocks,
  toggleWatchlist,
  updateWatchlistOrder,
} from "./stock.controller";
import {
  getDomesticFinancialSummarySchema,
  getDomesticStockQuoteSchema,
  getIndexCandleSchema,
  getIndexMinuteChartQuerySchema,
  getIndexPriceParamsSchema,
  getOrderbookSchema,
  getStockCandleSchema,
  getStockCodeSchema,
  getStockMasterSchema,
  getWatchlistSchema,
  searchStockSchema,
  toggleWatchlistSchema,
  updateWatchlistOrderSchema,
} from "./stock.schema";

const router = Router();

router.get(
  "/candle",
  validateMiddleware({ query: getStockCandleSchema }),
  getStockCandle
);

router.get(
  "/index/candle",
  validateMiddleware({ query: getIndexCandleSchema }),
  getIndexCandle
);

router.get(
  "/index/:industryCode/minute-chart",
  validateMiddleware({
    params: getIndexPriceParamsSchema,
    query: getIndexMinuteChartQuerySchema,
  }),
  getIndexMinuteChart
);

router.get(
  "/search",
  validateMiddleware({ query: searchStockSchema }),
  searchStocks
);

router.get(
  "/watchlist",
  verifyAccessTokenMiddleware,
  validateMiddleware({ query: getWatchlistSchema }),
  getWatchlist
);

router.patch(
  "/watchlist/order",
  verifyAccessTokenMiddleware,
  validateMiddleware({ body: updateWatchlistOrderSchema }),
  updateWatchlistOrder
);

router.delete("/watchlist", verifyAccessTokenMiddleware, deleteAllWatchlist);

router.get(
  "/:code/quote",
  validateMiddleware({
    params: getStockCodeSchema,
    query: getDomesticStockQuoteSchema,
  }),
  getStockQuote
);

router.get(
  "/:code/orderbook",
  validateMiddleware({
    params: getStockCodeSchema,
    query: getOrderbookSchema,
  }),
  getOrderbook
);

router.get(
  "/:code/financials",
  validateMiddleware({
    params: getStockCodeSchema,
    query: getDomesticFinancialSummarySchema,
  }),
  getDomesticFinancialSummary
);

router.get(
  "/:code",
  optionalVerifyAccessTokenMiddleware,
  validateMiddleware({
    params: getStockCodeSchema,
    query: getStockMasterSchema,
  }),
  getStockMaster
);

router.post(
  "/:code/watchlist",
  verifyAccessTokenMiddleware,
  validateMiddleware({
    params: getStockCodeSchema,
    query: toggleWatchlistSchema,
  }),
  toggleWatchlist
);

export default router;

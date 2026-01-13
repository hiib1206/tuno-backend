import { Router } from "express";
import {
  getDomesticFinancialSummary,
  getStockCandle,
  getStockMaster,
  getStockQuote,
  searchStocks,
} from "../controller/stock.controller";
import { validateMiddleware } from "../middleware/validation.middleware";
import {
  getDomesticFinancialSummarySchema,
  getDomesticStockQuoteSchema,
  getStockCandleSchema,
  getStockCodeSchema,
  getStockMasterSchema,
  searchStockSchema,
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

// GET /api/stock/search?q=삼성&type=all&limit=10
stockRouter.get(
  "/search",
  validateMiddleware({
    query: searchStockSchema,
  }),
  searchStocks
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
  validateMiddleware({
    params: getStockCodeSchema,
    query: getStockMasterSchema,
  }),
  getStockMaster
);

export default stockRouter;

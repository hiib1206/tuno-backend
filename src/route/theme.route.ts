import { Router } from "express";
import {
  getSpecialThemes,
  getThemeStocks,
} from "../controller/theme.controller";
import { validateMiddleware } from "../middleware/validation.middleware";
import {
  getSpecialThemesSchema,
  getThemeStocksParamsSchema,
} from "../schema/theme.schema";

const themeRouter = Router();

// GET /api/theme/special?gubun=1
themeRouter.get(
  "/special",
  validateMiddleware({ query: getSpecialThemesSchema }),
  getSpecialThemes
);

// GET /api/theme/:tmcode/stocks
themeRouter.get(
  "/:tmcode/stocks",
  validateMiddleware({ params: getThemeStocksParamsSchema }),
  getThemeStocks
);

export default themeRouter;

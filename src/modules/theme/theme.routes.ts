import { Router } from "express";
import { validateMiddleware } from "../../middleware/validation.middleware";
import { getSpecialThemes, getThemeStocks } from "./theme.controller";
import {
  getSpecialThemesSchema,
  getThemeStocksParamsSchema,
} from "./theme.schema";

const router = Router();

router.get(
  "/special",
  validateMiddleware({ query: getSpecialThemesSchema }),
  getSpecialThemes
);

router.get(
  "/:tmcode/stocks",
  validateMiddleware({ params: getThemeStocksParamsSchema }),
  getThemeStocks
);

export default router;

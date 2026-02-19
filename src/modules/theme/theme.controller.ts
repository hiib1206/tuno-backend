import { Request, Response } from "express";
import { sendSuccess } from "../../shared/utils/commonResponse";
import {
  GetSpecialThemesSchema,
  GetThemeStocksParamsSchema,
  ThemeStocksResult,
} from "./theme.schema";
import {
  getSpecialThemesService,
  getThemeStocksService,
} from "./theme.service";

/** 특이테마를 조회한다. */
export const getSpecialThemes = async (req: Request, res: Response) => {
  const { gubun } = req.validated?.query as GetSpecialThemesSchema;
  const data = await getSpecialThemesService(gubun);

  return sendSuccess(res, 200, "특이테마 조회 성공", data);
};

/** 테마 종목을 조회한다. */
export const getThemeStocks = async (req: Request, res: Response) => {
  const { tmcode } = req.validated?.params as GetThemeStocksParamsSchema;
  const data: ThemeStocksResult = await getThemeStocksService(tmcode);

  return sendSuccess(res, 200, "테마 종목 조회 성공", data);
};

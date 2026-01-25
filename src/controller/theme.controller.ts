import { NextFunction, Request, Response } from "express";
import {
  GetSpecialThemesSchema,
  GetThemeStocksParamsSchema,
} from "../schema/theme.schema";
import { handleLSError } from "../securities/ls";
import {
  getSpecialThemesService,
  getThemeStocksService,
} from "../service/theme.service";
import { sendSuccess } from "../utils/commonResponse";

// 특이테마 조회
export const getSpecialThemes = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { gubun } = req.validated?.query as GetSpecialThemesSchema;
    const data = await getSpecialThemesService(gubun);

    return sendSuccess(res, 200, "특이테마 조회 성공", data);
  } catch (error) {
    if (handleLSError(res, error)) return;
    next(error);
  }
};

// 테마 종목 조회
export const getThemeStocks = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { tmcode } = req.validated?.params as GetThemeStocksParamsSchema;
    const data = await getThemeStocksService(tmcode);

    return sendSuccess(res, 200, "테마 종목 조회 성공", data);
  } catch (error) {
    if (handleLSError(res, error)) return;
    next(error);
  }
};

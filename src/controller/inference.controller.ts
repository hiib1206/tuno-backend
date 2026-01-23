import { NextFunction, Request, Response } from "express";
import { handleTunoAiAxiosError, tunoAiClient } from "../config/tunoAiClient";
import { SnapbackInferenceBodySchema } from "../schema/inference.schema";
import { SnapbackV2Response } from "../types/inference";
import { sendSuccess } from "../utils/commonResponse";

export const postSnapbackInference = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { ticker, date } = req.validated?.body as SnapbackInferenceBodySchema;

    const response = await tunoAiClient.post<SnapbackV2Response>(
      "/api/v1/inference/snapback",
      { ticker, end_date: date ?? null },
      { timeout: 120000 }
    );

    return sendSuccess(res, 200, "snapback 추론 결과를 조회했습니다.", response.data as SnapbackV2Response);
  } catch (error) {
    if (handleTunoAiAxiosError(res, error)) return;
    next(error);
  }
};

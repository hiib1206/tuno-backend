import { Request, Response } from "express";
import { sendSuccess } from "../../shared/utils/commonResponse";
import { UserPayload } from "../../shared/utils/token";
import {
  GetInferenceHistoryByIdParamsSchema,
  GetInferenceHistoryQuerySchema,
  QuantSignalInferenceBodySchema,
  SnapbackInferenceBodySchema,
} from "./inference.schema";
import {
  deleteInferenceHistoryService,
  getInferenceHistoryByIdService,
  getInferenceHistoryService,
  getQuotaInfoService,
  postQuantSignalInferenceService,
  postSnapbackInferenceService,
} from "./inference.service";

/** Snapback 추론을 요청한다. */
export const postSnapbackInference = async (req: Request, res: Response) => {
  const userId = (req.user as UserPayload)?.userId;
  const { ticker, date } = req.validated?.body as SnapbackInferenceBodySchema;
  const userRole = req.userRole;

  const result = await postSnapbackInferenceService(userId, ticker, date, userRole);

  // 쿼터 헤더 설정
  if (result.quota) {
    res.setHeader("X-Quota-Used", result.quota.used.toString());
    res.setHeader("X-Quota-Remaining", result.quota.remaining.toString());
    res.setHeader("X-Quota-Reset", result.quota.reset.toString());
  }

  return sendSuccess(res, 200, "snapback 추론 결과를 조회했습니다.", result.data);
};

/** Quant Signal 추론을 요청한다. */
export const postQuantSignalInference = async (req: Request, res: Response) => {
  const userId = (req.user as UserPayload)?.userId;
  const { ticker, date } = req.validated?.body as QuantSignalInferenceBodySchema;

  const result = await postQuantSignalInferenceService(userId, ticker, date);

  return sendSuccess(res, 202, "추론 요청이 접수되었습니다.", result.data);
};

/** 추론 이력 목록을 조회한다. */
export const getInferenceHistory = async (req: Request, res: Response) => {
  const userId = (req.user as UserPayload)?.userId;
  const { cursor, limit, model_type, ticker, days, status, all } =
    req.validated?.query as GetInferenceHistoryQuerySchema;

  const result = await getInferenceHistoryService(
    userId,
    cursor,
    limit,
    model_type,
    ticker,
    days,
    status,
    all
  );

  return sendSuccess(res, 200, "AI 추론 이력을 조회했습니다.", result.data);
};

/** 추론 이력을 단건 조회한다. */
export const getInferenceHistoryById = async (req: Request, res: Response) => {
  const userId = (req.user as UserPayload)?.userId;
  const { id } = req.validated?.params as GetInferenceHistoryByIdParamsSchema;

  const result = await getInferenceHistoryByIdService(userId, id);

  return sendSuccess(res, 200, "AI 추론 이력을 조회했습니다.", result.data);
};

/** 쿼터 정보를 조회한다. */
export const getQuotaInfo = async (req: Request, res: Response) => {
  const userId = (req.user as UserPayload)?.userId;

  const result = await getQuotaInfoService(userId);

  return sendSuccess(res, 200, "쿼터 정보를 조회했습니다.", result.data);
};

/** 추론 이력을 삭제한다. */
export const deleteInferenceHistory = async (req: Request, res: Response) => {
  const userId = (req.user as UserPayload)?.userId;
  const { id } = req.validated?.params as GetInferenceHistoryByIdParamsSchema;

  await deleteInferenceHistoryService(userId, id);

  return sendSuccess(res, 200, "AI 추론 이력을 삭제했습니다.");
};

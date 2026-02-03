import { AxiosError } from "axios";
import { NextFunction, Request, Response } from "express";
import prisma from "../config/prisma";
import { handleTunoAiAxiosError, tunoAiClient } from "../config/tunoAiClient";
import { ai_model_type, inference_status } from "../generated/prisma/enums";
import {
  GetInferenceHistoryByIdParamsSchema,
  GetInferenceHistoryQuerySchema,
  QuantSignalInferenceBodySchema,
  SnapbackInferenceBodySchema,
} from "../schema/inference.schema";
import {
  InferenceErrorCode,
  QuantSignalV1Response,
  SnapbackV2Response,
} from "../types/inference";
import { sendError, sendSuccess } from "../utils/commonResponse";
import { UserPayload } from "../utils/token";

export const postSnapbackInference = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const startTime = Date.now();
  let historyId: bigint | null = null;

  try {
    const userId = (req.user as UserPayload)?.userId;
    const { ticker, date } = req.validated?.body as SnapbackInferenceBodySchema;

    // 종목 마스터에서 exchange 조회
    const stockMaster = await prisma.krx_stock_master.findFirst({
      where: { mksc_shrn_iscd: ticker },
      select: { market_code: true },
    });

    // 히스토리 레코드 생성
    const history = await prisma.ai_inference_history.create({
      data: {
        user_id: userId,
        model_type: ai_model_type.SNAPBACK,
        model_version: "2.0",
        ticker,
        exchange: stockMaster?.market_code ?? null,
        request_params: { ticker, date },
        status: inference_status.PROCESSING,
      },
    });
    historyId = history.id;

    // AI 서버 호출
    const response = await tunoAiClient.post<SnapbackV2Response>(
      "/api/v1/inference/snapback",
      { ticker, end_date: date ?? null },
      { timeout: 120000 }
    );

    // 성공 시 업데이트
    await prisma.ai_inference_history.update({
      where: { id: historyId },
      data: {
        status: inference_status.COMPLETED,
        response_data: response.data,
        latency_ms: Date.now() - startTime,
        completed_at: new Date(),
      },
    });

    return sendSuccess(res, 200, "snapback 추론 결과를 조회했습니다.", response.data);
  } catch (error) {
    // 실패 시 업데이트
    if (historyId) {
      const axiosError = error instanceof AxiosError ? error : null;
      const errorCode = axiosError?.response?.data?.detail?.code;
      const isCancellable = Object.values(InferenceErrorCode).includes(errorCode);

      await prisma.ai_inference_history.update({
        where: { id: historyId },
        data: {
          status: isCancellable ? inference_status.CANCELED : inference_status.FAILED,
          response_data: axiosError?.response?.data,
          latency_ms: Date.now() - startTime,
          completed_at: new Date(),
        },
      }).catch(() => { });
      if (isCancellable)
        return sendError(res, 400, "현재 조건에서는 추론을 진행할 수 없습니다.", axiosError?.response?.data?.detail);
    }

    if (handleTunoAiAxiosError(res, error)) return;
    next(error);
  }
};

// 백그라운드에서 실행되는 추론 함수
const runQuantSignalInference = async (
  historyId: bigint,
  ticker: string,
  date: string | null | undefined
) => {
  const startTime = Date.now();

  try {
    // PROCESSING 상태로 변경
    await prisma.ai_inference_history.update({
      where: { id: historyId },
      data: { status: inference_status.PROCESSING },
    });

    // AI 서버 호출
    const response = await tunoAiClient.post<QuantSignalV1Response>(
      "/api/v1/inference/quant-signal",
      { ticker, end_date: date ?? null },
      { timeout: 120000 }
    );

    // 성공 시 업데이트
    await prisma.ai_inference_history.update({
      where: { id: historyId },
      data: {
        status: inference_status.COMPLETED,
        response_data: response.data,
        latency_ms: Date.now() - startTime,
        completed_at: new Date(),
      },
    });
  } catch (error) {
    const axiosError = error instanceof AxiosError ? error : null;
    const errorCode = axiosError?.response?.data?.detail?.code;
    const isCancellable =
      Object.values(InferenceErrorCode).includes(errorCode);

    await prisma.ai_inference_history
      .update({
        where: { id: historyId },
        data: {
          status: isCancellable
            ? inference_status.CANCELED
            : inference_status.FAILED,
          response_data: axiosError?.response?.data,
          latency_ms: Date.now() - startTime,
          completed_at: new Date(),
        },
      })
      .catch(() => { });
  }
};

export const postQuantSignalInference = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req.user as UserPayload)?.userId;
    const { ticker, date } =
      req.validated?.body as QuantSignalInferenceBodySchema;

    // 종목 마스터에서 exchange 조회
    const stockMaster = await prisma.krx_stock_master.findFirst({
      where: { mksc_shrn_iscd: ticker },
      select: { market_code: true },
    });

    // 주가 데이터 개수 검증 (최소 240개 필요)
    const priceDataCount = await prisma.stock_domestic_daily.count({
      where: { mksc_shrn_iscd: ticker },
    });

    if (priceDataCount < 240) {
      return sendError(
        res,
        400,
        "주가 데이터가 부족합니다. 최소 1년 가량의 데이터가 필요합니다.",
        { required: 240, current: priceDataCount }
      );
    }

    // 히스토리 레코드 생성 (PENDING 상태)
    const history = await prisma.ai_inference_history.create({
      data: {
        user_id: userId,
        model_type: ai_model_type.QUANT_SIGNAL,
        model_version: "1.0",
        ticker,
        exchange: stockMaster?.market_code ?? null,
        request_params: { ticker, date },
        status: inference_status.PENDING,
      },
    });

    // 백그라운드에서 추론 실행 (await 없이)
    runQuantSignalInference(history.id, ticker, date);

    // 즉시 historyId 반환
    return sendSuccess(res, 202, "추론 요청이 접수되었습니다.", {
      historyId: history.id.toString(),
    });
  } catch (error) {
    next(error);
  }
};

export const getInferenceHistory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req.user as UserPayload)?.userId;
    const { cursor, limit, model_type, ticker, days, status } =
      req.validated?.query as GetInferenceHistoryQuerySchema;

    const histories = await prisma.ai_inference_history.findMany({
      where: {
        user_id: userId,
        deleted_at: null,
        ...(model_type && { model_type }),
        ...(ticker && { ticker }),
        ...(days && {
          requested_at: { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) },
        }),
        ...(status && { status }),
      },
      orderBy: { requested_at: "desc" },
      take: limit + 1,
      ...(cursor && {
        cursor: { id: BigInt(cursor) },
        skip: 1,
      }),
    });

    const hasNext = histories.length > limit;
    const items = hasNext ? histories.slice(0, -1) : histories;
    const nextCursor = hasNext ? items[items.length - 1]?.id.toString() : null;

    // 종목명 조회
    const tickers = [...new Set(items.map((i) => i.ticker).filter(Boolean))] as string[];
    const stockMasters = await prisma.krx_stock_master.findMany({
      where: { mksc_shrn_iscd: { in: tickers } },
      select: { mksc_shrn_iscd: true, hts_kor_isnm: true },
    });
    const nameMap = new Map(stockMasters.map((m) => [m.mksc_shrn_iscd, m.hts_kor_isnm]));

    return sendSuccess(res, 200, "AI 추론 이력을 조회했습니다.", {
      items: items.map((item) => ({
        ...item,
        id: item.id.toString(),
        nameKo: item.ticker ? nameMap.get(item.ticker) ?? null : null,
      })),
      nextCursor,
      hasNext,
    });
  } catch (error) {
    next(error);
  }
};

export const getInferenceHistoryById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req.user as UserPayload)?.userId;
    const { id } = req.validated?.params as GetInferenceHistoryByIdParamsSchema;

    const history = await prisma.ai_inference_history.findFirst({
      where: {
        id: BigInt(id),
        user_id: userId,
        deleted_at: null,
      },
    });

    if (!history) {
      return sendError(res, 404, "추론 이력을 찾을 수 없습니다.");
    }

    // 종목명 조회
    let nameKo: string | null = null;
    if (history.ticker) {
      const stockMaster = await prisma.krx_stock_master.findFirst({
        where: { mksc_shrn_iscd: history.ticker },
        select: { hts_kor_isnm: true },
      });
      nameKo = stockMaster?.hts_kor_isnm ?? null;
    }

    return sendSuccess(res, 200, "AI 추론 이력을 조회했습니다.", {
      ...history,
      id: history.id.toString(),
      nameKo,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteInferenceHistory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req.user as UserPayload)?.userId;
    const { id } = req.validated?.params as GetInferenceHistoryByIdParamsSchema;

    const history = await prisma.ai_inference_history.findFirst({
      where: {
        id: BigInt(id),
        user_id: userId,
        deleted_at: null,
      },
    });

    if (!history) {
      return sendError(res, 404, "추론 이력을 찾을 수 없습니다.");
    }

    await prisma.ai_inference_history.update({
      where: { id: history.id },
      data: { deleted_at: new Date() },
    });

    return sendSuccess(res, 200, "AI 추론 이력을 삭제했습니다.");
  } catch (error) {
    next(error);
  }
};

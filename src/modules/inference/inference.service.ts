import { AxiosError } from "axios";
import prisma from "../../config/prisma";
import redis from "../../config/redis";
import { tunoAiClient, wrapTunoAiError } from "../../config/tunoAiClient";
import {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
} from "../../shared/errors/AppError";
import { ai_model_type, inference_status } from "../../generated/prisma/enums";
import {
  InferenceErrorCode,
  QuantSignalV1Response,
  SnapbackV2Response,
} from "./inference.types";
import {
  DAILY_INFERENCE_LIMIT,
  decrementQuota,
  getQuotaRedisKey,
  getQuotaResetTimestamp,
  getUserRole,
  incrementQuota,
} from "../../shared/utils/role";
import { user_role } from "../../generated/prisma/enums";

// 쿼터 결과 타입
interface QuotaResult {
  used: number;
  remaining: number | "unlimited";
  reset: number;
}

/** Snapback 추론을 실행한다. */
export const postSnapbackInferenceService = async (
  userId: number,
  ticker: string,
  date: string | null | undefined,
  userRole: user_role | undefined
) => {
  const startTime = Date.now();
  let historyId: bigint | null = null;

  try {
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

    // 성공 시에만 쿼터 카운트 증가
    const limit = userRole ? DAILY_INFERENCE_LIMIT[userRole] : 0;
    let quotaResult: QuotaResult | null = null;

    if (limit !== 0) {
      const newUsage = await incrementQuota(userId);
      quotaResult = {
        used: newUsage,
        remaining: Math.max(0, limit - newUsage),
        reset: getQuotaResetTimestamp(),
      };
    }

    return { data: response.data, quota: quotaResult };
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

      if (isCancellable) {
        throw new BadRequestError(
          "현재 조건에서는 추론을 진행할 수 없습니다.",
          axiosError?.response?.data?.detail
        );
      }
    }

    // Tuno AI Axios 에러를 ExternalApiError로 변환
    return wrapTunoAiError(error);
  }
};

/** 백그라운드에서 Quant Signal 추론을 실행한다. */
const runQuantSignalInference = async (
  historyId: bigint,
  ticker: string,
  date: string | null | undefined,
  userId: number
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
    const isCancellable = Object.values(InferenceErrorCode).includes(errorCode);

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

    // COMPLETED가 아니면 쿼터 환불
    await decrementQuota(userId).catch(() => { });
  }
};

/** Quant Signal 추론을 요청한다. */
export const postQuantSignalInferenceService = async (
  userId: number,
  ticker: string,
  date: string | null | undefined
) => {
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
    throw new BadRequestError(
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
  runQuantSignalInference(history.id, ticker, date, userId);

  return {
    data: {
      historyId: history.id.toString(),
    },
  };
};

/** 추론 이력 목록을 조회한다. */
export const getInferenceHistoryService = async (
  userId: number,
  cursor: string | undefined,
  limit: number,
  model_type: ai_model_type | undefined,
  ticker: string | undefined,
  days: number | undefined,
  status: inference_status | undefined,
  all: boolean | undefined
) => {
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
    take: all && days ? undefined : limit + 1,
    ...(!all && cursor && {
      cursor: { id: BigInt(cursor) },
      skip: 1,
    }),
  });

  const hasNext = all ? false : histories.length > limit;
  const items = hasNext ? histories.slice(0, -1) : histories;
  const nextCursor = hasNext ? items[items.length - 1]?.id.toString() : null;

  // 종목명 조회
  const tickers = [...new Set(items.map((i) => i.ticker).filter(Boolean))] as string[];
  const stockMasters = await prisma.krx_stock_master.findMany({
    where: { mksc_shrn_iscd: { in: tickers } },
    select: { mksc_shrn_iscd: true, hts_kor_isnm: true },
  });
  const nameMap = new Map(stockMasters.map((m) => [m.mksc_shrn_iscd, m.hts_kor_isnm]));

  return {
    data: {
      items: items.map((item) => ({
        ...item,
        id: item.id.toString(),
        nameKo: item.ticker ? nameMap.get(item.ticker) ?? null : null,
      })),
      nextCursor,
      hasNext,
    },
  };
};

/** 추론 이력을 단건 조회한다. */
export const getInferenceHistoryByIdService = async (
  userId: number,
  id: string
) => {
  const history = await prisma.ai_inference_history.findFirst({
    where: {
      id: BigInt(id),
      user_id: userId,
      deleted_at: null,
    },
  });

  if (!history) {
    throw new NotFoundError("추론 이력을 찾을 수 없습니다.");
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

  return {
    data: {
      ...history,
      id: history.id.toString(),
      nameKo,
    },
  };
};

/** 쿼터 정보를 조회한다. */
export const getQuotaInfoService = async (userId: number) => {
  const role = await getUserRole(userId);

  if (!role) {
    throw new UnauthorizedError("사용자를 찾을 수 없습니다.");
  }

  const limit = DAILY_INFERENCE_LIMIT[role];
  const resetsAt = getQuotaResetTimestamp();

  if (limit === 0) {
    return {
      data: {
        role,
        limit: "unlimited",
        used: 0,
        remaining: "unlimited",
        resetsAt,
      },
    };
  }

  const redisKey = getQuotaRedisKey(userId);
  const currentUsage = parseInt((await redis.get(redisKey)) ?? "0", 10);

  return {
    data: {
      role,
      limit,
      used: currentUsage,
      remaining: Math.max(0, limit - currentUsage),
      resetsAt,
    },
  };
};

/** 추론 이력을 삭제한다. */
export const deleteInferenceHistoryService = async (
  userId: number,
  id: string
) => {
  const history = await prisma.ai_inference_history.findFirst({
    where: {
      id: BigInt(id),
      user_id: userId,
      deleted_at: null,
    },
  });

  if (!history) {
    throw new NotFoundError("추론 이력을 찾을 수 없습니다.");
  }

  await prisma.ai_inference_history.update({
    where: { id: history.id },
    data: { deleted_at: new Date() },
  });

  return { data: null };
};

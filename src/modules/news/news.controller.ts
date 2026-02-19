import { NextFunction, Request, Response } from "express";
import { sendSuccess } from "../../shared/utils/commonResponse";

/**
 * SSE(Server-Sent Events) 연결을 관리하는 헬퍼 클래스
 */
class SSEConnection {
  constructor(private res: Response) {
    this.res.setHeader("Content-Type", "text/event-stream");
    this.res.setHeader("Cache-Control", "no-cache");
    this.res.setHeader("Connection", "keep-alive");
    this.res.setHeader("X-Accel-Buffering", "no");
  }

  send(event: string, data: object): void {
    this.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  end(): void {
    this.res.end();
  }
}
import {
  CreateNewsJobSchema,
  GetNewsBySearchSchema,
  GetNewsByTopicParamsSchema,
  GetNewsListSchema,
  StreamNewsJobParamsSchema,
} from "./news.schema";
import {
  createNewsJobService,
  deleteJob,
  getJobUrls,
  getNewsBySearchService,
  getNewsByTopicService,
  getNewsService,
  processNewsUrls,
} from "./news.service";

/** 주요 뉴스를 조회한다. */
export const getNews = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { cursor, limit } = req.validated?.query as GetNewsListSchema;

    const { items, meta } = await getNewsService(cursor, limit);

    return sendSuccess(res, 200, "주요 뉴스를 조회했습니다.", {
      news: items,
      ...meta,
    });
  } catch (error) {
    next(error);
  }
};

/** 토픽별 뉴스를 조회한다. */
export const getNewsByTopic = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { topics } = req.validated?.params as GetNewsByTopicParamsSchema;
    const { cursor, limit } = req.validated?.query as GetNewsListSchema;

    const { items, meta } = await getNewsByTopicService(topics, cursor, limit);

    return sendSuccess(res, 200, "토픽별 뉴스를 조회했습니다.", {
      news: items,
      ...meta,
    });
  } catch (error) {
    next(error);
  }
};

/** 검색 뉴스를 조회한다. */
export const getNewsBySearch = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { q, cursor, limit } = req.validated?.query as GetNewsBySearchSchema;

    const { items, meta } = await getNewsBySearchService(q, cursor, limit);

    return sendSuccess(res, 200, "검색 결과를 조회했습니다.", {
      news: items,
      ...meta,
    });
  } catch (error) {
    next(error);
  }
};

/** 뉴스 이미지 추출 작업을 예약한다. */
export const createNewsJob = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { urls } = req.validated?.body as CreateNewsJobSchema;

    const data = await createNewsJobService(urls);

    return sendSuccess(res, 201, "뉴스 이미지 추출 작업이 예약되었습니다.", data);
  } catch (error) {
    next(error);
  }
};

/** 뉴스 이미지 추출 결과를 SSE로 스트리밍한다. */
export const streamNewsJob = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { jobId } = req.validated?.params as StreamNewsJobParamsSchema;

    const urls = await getJobUrls(jobId);

    if (urls.length === 0) {
      return res.status(404).json({
        success: false,
        message: "작업을 찾을 수 없거나 이미 만료되었습니다.",
      });
    }

    const sse = new SSEConnection(res);

    let isClientConnected = true;
    req.on("close", () => {
      isClientConnected = false;
    });

    processNewsUrls(urls, {
      onSuccess: (data) => sse.send("success", data),
      onError: (error) => sse.send("error", error),
      onComplete: async () => {
        sse.send("completed", {});
        sse.end();
        await deleteJob(jobId);
      },
      shouldContinue: () => isClientConnected,
    });
  } catch (error) {
    next(error);
  }
};

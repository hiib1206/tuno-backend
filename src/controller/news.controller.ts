import crypto from "crypto";
import { NextFunction, Request, Response } from "express";
import redis from "../config/redis";
import {
  CreateNewsJobSchema,
  GetNewsBySearchSchema,
  GetNewsByTopicParamsSchema,
  GetNewsListSchema,
  StreamNewsJobParamsSchema,
} from "../schema/news.schema";
import { sendSuccess } from "../utils/commonResponse";
import {
  createHomeRssUrl,
  createSearchRssUrl,
  createTopicRssUrl,
  fetchGoogleNews,
  getNewsWithThumbnail,
} from "../utils/googleNews";

// Redis 키 설정
const JOB_KEY_PREFIX = "news:job:";
const IMAGE_KEY_PREFIX = "news:image:";
const JOB_TTL = 300; // 5분
const IMAGE_TTL = 86400; // 24시간

// RSS URL을 해시하여 Redis 키로 사용
const hashRssUrl = (url: string): string => {
  return crypto.createHash("md5").update(url).digest("hex"); // md5는 32글자
};

// 주요 뉴스 조회 (커서 페이지네이션 적용)
export const getNews = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // 검증된 쿼리 파라미터 사용
    const { cursor, limit } = req.validated?.query as GetNewsListSchema;

    const url = createHomeRssUrl();

    // 페이지네이션 처리된 데이터 가져오기
    const { items, meta } = await fetchGoogleNews(url, cursor, limit);

    return sendSuccess(res, 200, "주요 뉴스를 조회했습니다.", {
      news: items,
      ...meta, // { nextCursor, hasNextPage }
    });
  } catch (error) {
    next(error);
  }
};

// 토픽별 뉴스 조회 (커서 페이지네이션 적용)
export const getNewsByTopic = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // 검증된 파라미터와 쿼리 사용
    const { topics } = req.validated?.params as GetNewsByTopicParamsSchema;
    const { cursor, limit } = req.validated?.query as GetNewsListSchema;

    const url = createTopicRssUrl(topics);

    // 페이지네이션 처리된 데이터 가져오기
    const { items, meta } = await fetchGoogleNews(url, cursor, limit);

    return sendSuccess(res, 200, "토픽별 뉴스를 조회했습니다.", {
      news: items,
      ...meta, // { nextCursor, hasNextPage }
    });
  } catch (error) {
    next(error);
  }
};

// 검색 뉴스 조회 (커서 페이지네이션 적용)
export const getNewsBySearch = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // 검증된 쿼리 파라미터 사용
    const { q, cursor, limit } = req.validated?.query as GetNewsBySearchSchema;

    const url = createSearchRssUrl(q);

    // 페이지네이션 처리된 데이터 가져오기
    const { items, meta } = await fetchGoogleNews(url, cursor, limit);

    return sendSuccess(res, 200, "검색 결과를 조회했습니다.", {
      news: items,
      ...meta, // { nextCursor, hasNextPage }
    });
  } catch (error) {
    next(error);
  }
};

// 뉴스 이미지 추출 작업 예약
export const createNewsJob = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { urls } = req.validated?.body as CreateNewsJobSchema;

    // 고유한 jobId 생성
    const jobId = crypto.randomUUID();
    const jobKey = `${JOB_KEY_PREFIX}${jobId}`;

    // Redis List에 URL 저장
    await redis.rpush(jobKey, ...urls);
    await redis.expire(jobKey, JOB_TTL);

    return sendSuccess(res, 201, "뉴스 이미지 추출 작업이 예약되었습니다.", {
      jobId,
    });
  } catch (error) {
    next(error);
  }
};

// 뉴스 이미지 추출 결과 SSE 스트리밍
export const streamNewsJob = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { jobId } = req.validated?.params as StreamNewsJobParamsSchema;
    const jobKey = `${JOB_KEY_PREFIX}${jobId}`;
    // Redis에서 URL 리스트 가져오기
    const urls = await redis.lrange(jobKey, 0, -1);

    if (urls.length === 0) {
      return res.status(404).json({
        success: false,
        message: "작업을 찾을 수 없거나 이미 만료되었습니다.",
      });
    }

    // SSE 헤더 설정
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // nginx 버퍼링 비활성화

    // 클라이언트 연결 종료 감지
    let isClientConnected = true;
    req.on("close", () => {
      isClientConnected = false;
    });

    // 완료된 작업 수 추적
    let completedCount = 0;
    const totalCount = urls.length;

    // 각 URL에 대해 개별적으로 비동기 처리
    const processUrl = async (rssUrl: string) => {
      if (!isClientConnected) return;

      try {
        const rssHash = hashRssUrl(rssUrl);
        const imageKey = `${IMAGE_KEY_PREFIX}${rssHash}`;

        // 캐시 확인
        const cached = await redis.hgetall(imageKey);

        let result: {
          rssUrl: string;
          originalUrl: string;
          thumbnail: string;
        };

        if (cached && (cached as any).originalUrl) {
          // 캐시 히트
          result = {
            rssUrl,
            originalUrl: (cached as any).originalUrl,
            thumbnail: (cached as any).thumbnail,
          };
        } else {
          // 캐시 미스 - 파싱 수행
          const parsed = await getNewsWithThumbnail(rssUrl);

          // 파싱 실패 또는 썸네일이 빈 문자열인 경우 에러로 처리
          if (!parsed || parsed.thumbnail === "") {
            if (isClientConnected) {
              res.write(
                `event: error\ndata: ${JSON.stringify({
                  rssUrl,
                  message: "파싱 실패",
                })}\n\n`
              );
            }
            return; // finally 블록은 여전히 실행됨 (completedCount++ 됨)
          }

          // 결과를 Redis에 캐싱
          await redis.hset(imageKey, {
            originalUrl: parsed.originalUrl,
            thumbnail: parsed.thumbnail,
          });
          await redis.expire(imageKey, IMAGE_TTL);

          result = {
            rssUrl,
            originalUrl: parsed.originalUrl,
            thumbnail: parsed.thumbnail,
          };
        }

        // 즉시 SSE로 결과 전송 (event: success)
        if (isClientConnected) {
          res.write(`event: success\ndata: ${JSON.stringify(result)}\n\n`);
        }
      } catch (error) {
        // 개별 URL 처리 실패 시에도 에러 메시지를 SSE로 전송 (event: error)
        if (isClientConnected) {
          res.write(
            `event: error\ndata: ${JSON.stringify({
              rssUrl,
              message: "파싱 실패",
            })}\n\n`
          );
        }
      } finally {
        completedCount++;

        // 모든 작업 완료 시 종료 이벤트 전송 (event: completed)
        if (completedCount === totalCount && isClientConnected) {
          res.write(`event: completed\ndata: {}\n\n`);
          res.end();

          // 작업 완료 후 Redis에서 job 삭제
          await redis.del(jobKey);
        }
      }
    };

    // 모든 URL을 병렬로 처리 (각 작업이 완료되면 즉시 SSE 전송)
    urls.forEach((url) => {
      processUrl(url);
    });
  } catch (error) {
    next(error);
  }
};

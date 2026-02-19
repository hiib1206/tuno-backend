import crypto from "crypto";
import redis from "../../config/redis";
import {
  createHomeRssUrl,
  createSearchRssUrl,
  createTopicRssUrl,
  fetchGoogleNews,
  getNewsWithThumbnail,
} from "./news.utils";

const JOB_KEY_PREFIX = "news:job:";
const IMAGE_KEY_PREFIX = "news:image:";
const JOB_TTL = 300;
const IMAGE_TTL = 86400;

/** RSS URL을 해시하여 Redis 키로 사용한다. */
const hashRssUrl = (url: string): string => {
  return crypto.createHash("md5").update(url).digest("hex");
};

/** 주요 뉴스를 조회한다. */
export const getNewsService = async (cursor?: string, limit?: number) => {
  const url = createHomeRssUrl();
  return fetchGoogleNews(url, cursor, limit);
};

/** 토픽별 뉴스를 조회한다. */
export const getNewsByTopicService = async (
  topics: string,
  cursor?: string,
  limit?: number
) => {
  const url = createTopicRssUrl(topics);
  return fetchGoogleNews(url, cursor, limit);
};

/** 검색 뉴스를 조회한다. */
export const getNewsBySearchService = async (
  q: string,
  cursor?: string,
  limit?: number
) => {
  const url = createSearchRssUrl(q);
  return fetchGoogleNews(url, cursor, limit);
};

/** 뉴스 이미지 추출 작업을 예약한다. */
export const createNewsJobService = async (
  urls: string[]
): Promise<{ jobId: string }> => {
  const jobId = crypto.randomUUID();
  const jobKey = `${JOB_KEY_PREFIX}${jobId}`;

  await redis.rpush(jobKey, ...urls);
  await redis.expire(jobKey, JOB_TTL);

  return { jobId };
};

/** 작업 URL 목록을 조회한다. */
export const getJobUrls = async (jobId: string): Promise<string[]> => {
  const jobKey = `${JOB_KEY_PREFIX}${jobId}`;
  return redis.lrange(jobKey, 0, -1);
};

/** 작업을 삭제한다. */
export const deleteJob = async (jobId: string): Promise<void> => {
  const jobKey = `${JOB_KEY_PREFIX}${jobId}`;
  await redis.del(jobKey);
};

/** 단일 URL의 이미지를 추출한다. */
export const processNewsUrl = async (
  rssUrl: string
): Promise<{
  success: boolean;
  data?: { rssUrl: string; originalUrl: string; thumbnail: string };
  error?: string;
}> => {
  try {
    const rssHash = hashRssUrl(rssUrl);
    const imageKey = `${IMAGE_KEY_PREFIX}${rssHash}`;

    const cached = await redis.hgetall(imageKey);

    if (cached && (cached as any).originalUrl) {
      return {
        success: true,
        data: {
          rssUrl,
          originalUrl: (cached as any).originalUrl,
          thumbnail: (cached as any).thumbnail,
        },
      };
    }

    const parsed = await getNewsWithThumbnail(rssUrl);

    if (!parsed || parsed.thumbnail === "") {
      return { success: false, error: "파싱 실패" };
    }

    await redis.hset(imageKey, {
      originalUrl: parsed.originalUrl,
      thumbnail: parsed.thumbnail,
    });
    await redis.expire(imageKey, IMAGE_TTL);

    return {
      success: true,
      data: {
        rssUrl,
        originalUrl: parsed.originalUrl,
        thumbnail: parsed.thumbnail,
      },
    };
  } catch (error) {
    return { success: false, error: "파싱 실패" };
  }
};

/** 뉴스 URL 일괄 처리를 위한 콜백 인터페이스. */
export interface ProcessNewsUrlsCallbacks {
  onSuccess: (data: { rssUrl: string; originalUrl: string; thumbnail: string }) => void;
  onError: (error: { rssUrl: string; message: string }) => void;
  onComplete: () => void;
  shouldContinue: () => boolean;
}

/**
 * 여러 뉴스 URL을 병렬로 처리하고 콜백을 통해 결과를 전달한다.
 *
 * @param urls - 처리할 RSS URL 배열
 * @param callbacks - 결과 처리를 위한 콜백 객체
 */
export const processNewsUrls = (
  urls: string[],
  callbacks: ProcessNewsUrlsCallbacks
): void => {
  let completedCount = 0;
  const totalCount = urls.length;

  urls.forEach(async (rssUrl) => {
    if (!callbacks.shouldContinue()) return;

    try {
      const result = await processNewsUrl(rssUrl);

      if (callbacks.shouldContinue()) {
        if (result.success && result.data) {
          callbacks.onSuccess(result.data);
        } else {
          callbacks.onError({ rssUrl, message: result.error || "파싱 실패" });
        }
      }
    } catch (error) {
      if (callbacks.shouldContinue()) {
        callbacks.onError({ rssUrl, message: "파싱 실패" });
      }
    } finally {
      completedCount++;

      if (completedCount === totalCount && callbacks.shouldContinue()) {
        callbacks.onComplete();
      }
    }
  });
};

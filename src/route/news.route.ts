import { Router } from "express";
import {
  createNewsJob,
  getNews,
  getNewsBySearch,
  getNewsByTopic,
  streamNewsJob,
} from "../controller/news.controller";
import { validateMiddleware } from "../middleware/validation.middleware";
import {
  createNewsJobSchema,
  getNewsBySearchSchema,
  getNewsByTopicParamsSchema,
  getNewsListSchema,
  streamNewsJobParamsSchema,
} from "../schema/news.schema";

const newsRouter = Router();

// GET api/news (주요 뉴스 조회 - 커서 페이지네이션)
newsRouter.get("/", validateMiddleware({ query: getNewsListSchema }), getNews);

// GET api/news/search (검색 뉴스 조회 - 커서 페이지네이션)
newsRouter.get(
  "/search",
  validateMiddleware({ query: getNewsBySearchSchema }),
  getNewsBySearch
);

// POST api/news/jobs (뉴스 이미지 추출 작업 예약)
newsRouter.post(
  "/jobs",
  validateMiddleware({ body: createNewsJobSchema }),
  createNewsJob
);

// GET api/news/jobs/:jobId/stream (뉴스 이미지 추출 결과 SSE 스트리밍)
newsRouter.get(
  "/jobs/:jobId/stream",
  validateMiddleware({ params: streamNewsJobParamsSchema }),
  streamNewsJob
);

// GET api/news/:topics (토픽별 뉴스 조회 - 커서 페이지네이션)
newsRouter.get(
  "/:topics",
  validateMiddleware({
    params: getNewsByTopicParamsSchema,
    query: getNewsListSchema,
  }),
  getNewsByTopic
);

export default newsRouter;

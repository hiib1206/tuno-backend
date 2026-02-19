import { Router } from "express";
import { validateMiddleware } from "../../middleware/validation.middleware";
import {
  createNewsJob,
  getNews,
  getNewsBySearch,
  getNewsByTopic,
  streamNewsJob,
} from "./news.controller";
import {
  createNewsJobSchema,
  getNewsBySearchSchema,
  getNewsByTopicParamsSchema,
  getNewsListSchema,
  streamNewsJobParamsSchema,
} from "./news.schema";

const newsRouter = Router();

newsRouter.get("/", validateMiddleware({ query: getNewsListSchema }), getNews);

newsRouter.get(
  "/search",
  validateMiddleware({ query: getNewsBySearchSchema }),
  getNewsBySearch
);

newsRouter.post(
  "/jobs",
  validateMiddleware({ body: createNewsJobSchema }),
  createNewsJob
);

newsRouter.get(
  "/jobs/:jobId/stream",
  validateMiddleware({ params: streamNewsJobParamsSchema }),
  streamNewsJob
);

newsRouter.get(
  "/:topics",
  validateMiddleware({
    params: getNewsByTopicParamsSchema,
    query: getNewsListSchema,
  }),
  getNewsByTopic
);

export default newsRouter;

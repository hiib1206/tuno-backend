import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import passport from "./config/passport";
import { optionalDeviceIdMiddleware } from "./middleware/deviceId.middleware";
import { errorHandler } from "./middleware/error.middleware";
import { NotFoundError } from "./shared/errors/AppError";
import morganMiddleware from "./middleware/morgan.middleware";
import authRouter from "./modules/auth/auth.routes";
import inferenceRouter from "./modules/inference/inference.routes";
import newsRouter from "./modules/news/news.routes";
import notificationRouter from "./modules/notification/notification.routes";
import postCommentRouter from "./modules/post-comment/post-comment.routes";
import postRouter from "./modules/post/post.routes";
import stockCommentRouter from "./modules/stock-comment/stock-comment.routes";
import stockRouter from "./modules/stock/stock.routes";
import themeRouter from "./modules/theme/theme.routes";
import userRouter from "./modules/user/user.routes";
const app = express();

app.use(morganMiddleware);
app.use(
  cors({
    origin: [
      "https://tunoinvest.com",
      "http://127.0.0.1:3000",
      "http://localhost:3000",
      "http://localhost:3001",
    ],
    credentials: true,
    exposedHeaders: ["X-Quota-Limit", "X-Quota-Used", "X-Quota-Remaining", "X-Quota-Reset"],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(passport.initialize());
app.use(optionalDeviceIdMiddleware);

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api/auth", authRouter);
app.use("/api/user", userRouter);
app.use("/api/post", postRouter);
app.use("/api/comment", postCommentRouter);
app.use("/api/news", newsRouter);
app.use("/api/stock", stockRouter);
app.use("/api/stock-comment", stockCommentRouter);
app.use("/api/theme", themeRouter);
app.use("/api/inference", inferenceRouter);
app.use("/api/notification", notificationRouter);

app.use((_req, _res, next) => {
  next(new NotFoundError("요청한 리소스를 찾을 수 없습니다."));
});

app.use(errorHandler);

export default app;

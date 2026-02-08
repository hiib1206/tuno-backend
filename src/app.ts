import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import passport from "./config/passport";
import { optionalDeviceIdMiddleware } from "./middleware/deviceId.middleware";
import { errorHandler } from "./middleware/error.middleware";
import morganMiddleware from "./middleware/morgan.middleware";
import authRouter from "./route/auth.route";
import inferenceRouter from "./route/inference.route";
import newsRouter from "./route/news.route";
import notificationRouter from "./route/notification.route";
import postCommentRouter from "./route/post-comment.route";
import postRouter from "./route/post.route";
import stockCommentRouter from "./route/stock-comment.route";
import stockRouter from "./route/stock.route";
import testRouter from "./route/test.route";
import themeRouter from "./route/theme.route";
import userRouter from "./route/user.route";
const app = express();

// Middleware
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
// Passport 초기화
app.use(passport.initialize());
// 커스텀 미들웨어들
app.use(optionalDeviceIdMiddleware); // 전역: x-device-id 선택적 검증 (있으면 형식만 검증)

// Health check
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

// Routes
app.use("/api/test", testRouter);
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

// Error Handling
app.use(errorHandler);

export default app;

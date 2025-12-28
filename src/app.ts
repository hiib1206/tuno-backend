import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import passport from "./config/passport";
import { optionalDeviceIdMiddleware } from "./middleware/deviceId.middleware";
import { errorHandler } from "./middleware/error.middleware";
import morganMiddleware from "./middleware/morgan.middleware";
import authRouter from "./route/auth.route";
import newsRouter from "./route/news.route";
import postCommentRouter from "./route/post-comment.route";
import postRouter from "./route/post.route";
import testRouter from "./route/test.route";
import userRouter from "./route/user.route";
const app = express();

// Middleware
app.use(morganMiddleware);
app.use(
  cors({
    origin: [
      "http://127.0.0.1:3000",
      "http://localhost:3000",
      "http://localhost:3001",
      "http://59.25.224.32:3000",
    ],
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
// Passport 초기화
app.use(passport.initialize());
// 커스텀 미들웨어들
app.use(optionalDeviceIdMiddleware); // 전역: x-device-id 선택적 검증 (있으면 형식만 검증)

// Routes
app.use("/api/test", testRouter);
app.use("/api/auth", authRouter);
app.use("/api/user", userRouter);
app.use("/api/post", postRouter);
app.use("/api/comment", postCommentRouter);
app.use("/api/news", newsRouter);

// Error Handling
app.use(errorHandler);

export default app;

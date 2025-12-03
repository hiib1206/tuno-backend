import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { errorHandler } from "./middleware/error.middleware";
import { requireDeviceIdMiddleware } from "./middleware/deviceId.middleware";
import morganMiddleware from "./middleware/morgan.middleware";
import authRouter from "./route/auth.route";
import testRouter from "./route/test.route";
import userRouter from "./route/user.route";
const app = express();

// Middleware
app.use(morganMiddleware);
app.use(
  cors({
    origin: [
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
app.use(requireDeviceIdMiddleware); // 모든 요청에 x-device-id 필수 검증

// Routes
app.use("/api/test", testRouter);
app.use("/api/auth", authRouter);
app.use("/api/user", userRouter);

// Error Handling
app.use(errorHandler);

export default app;

import express from "express";
import { errorHandler } from "./middleware/error.middleware";
import authRouter from "./route/auth.route";
import cors from "cors";
import cookieParser from "cookie-parser";
import testRouter from "./route/test.route";
import morganMiddleware from "./middleware/morgan.middleware";
import userRouter from "./route/user.route";
const app = express();

// Middleware
app.use(morganMiddleware);
app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:3001"],
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Routes
app.use("/api/test", testRouter);
app.use("/api/auth", authRouter);
app.use("/api/user", userRouter);

// Error Handling
app.use(errorHandler);

export default app;

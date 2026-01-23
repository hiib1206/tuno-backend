import { Request } from "express";
import morgan from "morgan";
import logger from "../config/logger";

// URL에서 token 파라미터 마스킹
morgan.token("masked-url", (req: Request) => {
  const url = req.originalUrl || req.url || "";
  return url.replace(/([?&])token=[^&]*/g, "$1token=******");
});

const morganMiddleware = morgan(
  ":method :masked-url :status :response-time ms - :res[content-length] bytes",
  {
    // winston 연결
    stream: {
      write: (message: string) => {
        logger.info(message.trim());
      },
    },
    skip: (req) => req.method === "OPTIONS",
  }
);

export default morganMiddleware;

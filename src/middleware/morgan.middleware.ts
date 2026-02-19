import morgan from "morgan";
import logger from "../config/logger";

/**
 * HTTP 요청 로깅 미들웨어.
 *
 * @remarks
 * winston 로거로 요청 정보를 출력하며, OPTIONS 요청은 로깅하지 않는다.
 */
const morganMiddleware = morgan(
  ":method :url :status :response-time ms - :res[content-length] bytes",
  {
    stream: {
      write: (message: string) => {
        logger.info(message.trim());
      },
    },
    skip: (req) => req.method === "OPTIONS",
  }
);

export default morganMiddleware;

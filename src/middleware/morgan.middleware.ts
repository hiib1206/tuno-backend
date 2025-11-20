import morgan from "morgan";
import logger from "../config/logger";

const morganMiddleware = morgan(
  ":method :url :status :response-time ms - :res[content-length] bytes",
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

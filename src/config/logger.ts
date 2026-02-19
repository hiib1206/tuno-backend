import winston from "winston";
import { env } from "./env";

const { combine, timestamp, printf, colorize, json, errors } = winston.format;

/**
 * 개발용 포맷.
 * 사람이 읽기 좋은 형태로 출력하며, 에러 스택과 메타데이터를 포함한다.
 */
const devFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  let log = `${timestamp} [${level}] ${message}`;

  if (stack) {
    log += `\n${stack}`;
  }

  if (Object.keys(meta).length) {
    log += ` ${JSON.stringify(meta)}`;
  }

  return log;
});

/**
 * 프로덕션용 포맷.
 * JSON 형식으로 출력하여 로그 수집 도구에서 파싱 가능하게 한다.
 */
const prodFormat = combine(timestamp(), errors({ stack: true }), json());

/** winston 기반 애플리케이션 로거. */
const logger = winston.createLogger({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  format: combine(
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    errors({ stack: true })
  ),
  transports: [
    new winston.transports.Console({
      format:
        env.NODE_ENV === "production"
          ? prodFormat
          : combine(colorize(), devFormat),
    }),
  ],
});

export default logger;

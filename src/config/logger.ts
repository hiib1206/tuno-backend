import winston from "winston";

const { combine, timestamp, printf, colorize } = winston.format;

const logDir = "logs";

// 로그 출력 형식
const logFormat = printf(({ level, message, timestamp }) => {
  return `${timestamp} [${level}] ${message}`;
});

const logger = winston.createLogger({
  format: combine(timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), logFormat),
  transports: [
    // 콘솔 로그
    new winston.transports.Console({
      format: combine(colorize(), logFormat),
      level: "debug",
    }),

    // // 파일 로그 (하루 단위, error만)
    // new winstonDaily({
    //   level: "error",
    //   dirname: path.join(logDir, "error"),
    //   filename: "%DATE%.error.log",
    //   datePattern: "YYYY-MM-DD",
    //   format: winston.format.json(),
    //   maxFiles: "30d",
    //   zippedArchive: true,
    // }),

    // // 파일 로그 (하루 단위, 모든 로그)
    // new winstonDaily({
    //   dirname: path.join(logDir, "all"),
    //   filename: "%DATE%.all.log",
    //   datePattern: "YYYY-MM-DD",
    //   format: winston.format.json(),
    //   maxFiles: "30d",
    //   zippedArchive: true,
    // }),
  ],
});

export default logger;

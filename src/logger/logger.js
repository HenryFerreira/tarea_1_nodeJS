const path = require("path");
const fs = require("fs");
const { createLogger, format, transports, addColors } = require("winston");
const DailyRotateFile = require("winston-daily-rotate-file");

const LOG_LEVEL = process.env.LOG_LEVEL || "info";
const LOG_DIR = process.env.LOG_DIR || "logs";

// Aseguramos carpeta de logs
fs.mkdirSync(path.resolve(process.cwd(), LOG_DIR), { recursive: true });

// Niveles con uno específico para HTTP
const levels = { error: 0, warn: 1, info: 2, http: 3, debug: 4 };
const colors = { error: "red", warn: "yellow", info: "green", http: "magenta", debug: "blue" };
addColors(colors);

const baseFormat = format.combine(
  format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
  format.errors({ stack: true }),
  format.printf(({ timestamp, level, message, stack, ...meta }) => {
    const reqId = meta.reqId ? ` [reqId=${meta.reqId}]` : "";
    const rest = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
    return `${timestamp} ${level.toUpperCase()}${reqId} ${message}${stack ? "\n" + stack : ""}${rest}`;
  })
);

const logger = createLogger({
  level: LOG_LEVEL,
  levels,
  format: baseFormat,
  transports: [
    new transports.Console({
      level: LOG_LEVEL,
      format: format.combine(format.colorize({ all: true }), baseFormat),
    }),
    new DailyRotateFile({
      dirname: LOG_DIR,
      filename: "app-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxFiles: "14d",
      zippedArchive: true,
      level: LOG_LEVEL,
    }),
    new DailyRotateFile({
      dirname: LOG_DIR,
      filename: "errors-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxFiles: "30d",
      zippedArchive: true,
      level: "error",
    }),
  ],
});

// Para integrar morgan
logger.stream = {
  write: (message) => logger.http(message.trim()),
};

module.exports = { logger };

import { getConnInfo } from "@hono/node-server/conninfo";
import { createMiddleware } from "hono/factory";
import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";

export const createLogger = () => {
  const { IS_DEV } = process.env;

  const transport: DailyRotateFile = new DailyRotateFile({
    auditFile: "logs/log-audit.json",
    filename: "logs/%DATE%.log",
    datePattern: "YYYY-MM-DD",
    zippedArchive: false,
    maxSize: "20m",
    maxFiles: "30d",
  });

  const logger = winston.createLogger({
    level: "info",
    format: winston.format.combine(
      ...[
        winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        winston.format.printf(i => `>${i.level}:${i.timestamp}: ${JSON.stringify(i.message)}\n`),
      ],
    ),
    transports: IS_DEV ? [new winston.transports.Console()] : [transport],
  });

  return logger;
};

export const createLoggerMiddleware = (logger = createLogger()) => {
  return createMiddleware(async (c, next) => {
    try {
      c.set("logger", logger);
      const startTime = Date.now();
      await next();
      const { url, method } = c.req;
      const info = getConnInfo(c).remote;
      const connect = `${info.addressType} ${info.address}:${info.port}`;
      const requestId = c.var.requestId;
      const time = `${Date.now() - startTime}ms`;
      logger.info({
        requestId,
        url,
        method,
        connect,
        time,
      });
    } catch (error: any) {
      logger.error({ name: "logger middleware error:", error: error.toString() });
    }
  });
};

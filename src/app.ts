import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";
import { Pool } from "pg";
import { createJwtMiddlware } from "./middlewares/jwt";
import { createLogger, createLoggerMiddleware } from "./middlewares/logger";
import { createPgMiddleware } from "./middlewares/pg";
import { templateApp } from "./modules/template";
import { errorHandler } from "./utils/error-handler";

const boot = () => {
  const { PORT } = process.env;
  const app = new Hono();

  app.use(cors());

  app.use(requestId());

  const logger = createLogger();
  app.use(createLoggerMiddleware(logger));

  app.use(createJwtMiddlware());

  const pgPool = new Pool();
  app.use(createPgMiddleware(pgPool));

  app.route("/template", templateApp);

  app.onError(errorHandler);

  const server = serve(
    {
      fetch: app.fetch,
      port: Number(PORT),
    },
    info => {
      logger.info(`Server is running on http://localhost:${info.port}`);
    },
  );

  process.on("SIGINT", async () => {
    await pgPool.end();
    server.close();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await pgPool.end();
    server.close(err => {
      if (err) {
        logger.error(err);
        process.exit(1);
      }
      process.exit(0);
    });
  });
};

boot();

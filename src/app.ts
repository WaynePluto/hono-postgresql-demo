import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";
import { Pool } from "pg";
import { createJwtMiddleware } from "./middlewares/jwt";
import { createLogger, createLoggerMiddleware } from "./middlewares/logger";
import { createPgMiddleware } from "./middlewares/pg";
import { authApp } from "./modules/auth";
import { permissionApp } from "./modules/permission";
import { roleApp } from "./modules/role";
import { templateApp } from "./modules/template";
import { userApp } from "./modules/user";
import { errorHandler } from "./utils/error-handler";
import { initDB } from "./utils/init-db";

const boot = () => {
  const { PORT, JWT_SECRET } = process.env;
  const app = new Hono();

  app.use(cors());

  app.use(requestId());

  const logger = createLogger();
  app.use(createLoggerMiddleware(logger));

  app.use(createJwtMiddleware(JWT_SECRET));

  const pgPool = new Pool();
  initDB(pgPool);

  app.use(createPgMiddleware(pgPool));

  // 注册路由
  app.route("/auth", authApp);
  app.route("/user", userApp);
  app.route("/template", templateApp);
  app.route("/permission", permissionApp);
  app.route("/role", roleApp);

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

  return app;
};

boot();
import { createMiddleware } from "hono/factory";
import { Pool } from "pg";

export const createPgMiddleware = (pool: Pool) => {
  return createMiddleware(async (c, next) => {
    c.set("pool", pool);
    await next();
  });
};

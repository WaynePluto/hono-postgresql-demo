import "hono";
import type { Pool } from "pg";
import type winston from "winston";

declare interface JWTPayload {
  userId: string;
}

declare module "hono" {
  interface ContextVariableMap {
    pool: Pool;
    logger: winston.Logger;
    requestId: string;
    jwtPayload: JWTPayload;
  }
}

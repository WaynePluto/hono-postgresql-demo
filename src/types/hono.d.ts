import "hono";
import type { Pool } from "pg";
import type winston from "winston";
import type jwt from "jsonwebtoken";

declare interface JWTPayload {
  userId: string;
}

declare type JwtSign = (payload: JWTPayload) => { token: string; refresh_token: string };
declare type JwtVerify = (token: string) => Promise<{ err: jwt.VerifyErrors | null; decoded: any }>;

declare module "hono" {
  interface ContextVariableMap {
    pool: Pool;
    logger: winston.Logger;
    requestId: string;
    jwtPayload: JWTPayload;
    jwtSign: JwtSign;
    jwtVerify: JwtVerify;
  }
}
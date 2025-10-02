// 需要优化：修复拼写错误和逻辑问题
import { JWTPayload } from "@/types/hono";
import { createMiddleware } from "hono/factory";
import jwt from "jsonwebtoken";

export const createJwtSign = (secret: string) => (payload: JWTPayload) => {
  const token = jwt.sign(payload, secret, { expiresIn: "5m" });
  const refresh_token = jwt.sign(payload, secret, { expiresIn: "7d" });

  return { token, refresh_token };
};

export const createJwtVerify =
  (secret: string) =>
  (token: string): Promise<{ err: jwt.VerifyErrors | null; decoded: any }> => {
    return new Promise(resolve => {
      jwt.verify(token, secret, (err, decoded) => {
        resolve({ err, decoded });
      });
    });
  };

export const createJwtMiddleware = (secret = "jwt") => {
  const { IS_DEV } = process.env;
  const jwtSign = createJwtSign(secret);
  const jwtVerify = createJwtVerify(secret);

  return createMiddleware(async (c, next) => {
    c.set("jwtSign", jwtSign);
    c.set("jwtVerify", jwtVerify);

    const ignoreRoute = /\/auth\/(login|register|refresh)$/; // 添加refresh到忽略路由
    if (ignoreRoute.test(c.req.path)) {
      await next();
      return;
    }

    const token = c.req.header("Authorization")?.split(" ")[1];
    const data = IS_DEV ? jwtSign({ userId: "123" }) : null;
    if (token) {
      const { err, decoded } = await jwtVerify(token);
      if (err) {
        return c.json({ code: 401, msg: "登录过期", data });
      } else {
        c.set("jwtPayload", decoded);
        await next();
      }
    } else {
      return c.json({ code: 401, msg: "未登录", data });
    }
  });
};

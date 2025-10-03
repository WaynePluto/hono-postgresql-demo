// 需要优化：修复拼写错误和逻辑问题
import { JWTPayload } from "@/types/hono";
import { createMiddleware } from "hono/factory";
import jwt from "jsonwebtoken";

export const createJwtSign = (secret?: string) => (payload: JWTPayload) => {
  // 从环境变量获取JWT密钥，如果没有则使用默认值
  const jwtSecret = secret || process.env.JWT_SECRET || "jwt";
  const token = jwt.sign(payload, jwtSecret, { expiresIn: "5m" });
  const refresh_token = jwt.sign(payload, jwtSecret, { expiresIn: "7d" });

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

export const createJwtMiddleware = (secret?: string) => {
  // 从环境变量获取JWT密钥，如果没有则使用默认值
  const jwtSecret = secret || process.env.JWT_SECRET || "jwt";

  const jwtSign = createJwtSign(jwtSecret);
  const jwtVerify = createJwtVerify(jwtSecret);

  return createMiddleware(async (c, next) => {
    c.set("jwtSign", jwtSign);
    c.set("jwtVerify", jwtVerify);

    const ignoreRoute = /^\/auth\/(login|register|refresh)$/; // 添加refresh到忽略路由
    if (ignoreRoute.test(c.req.path)) {
      await next();
      return;
    }

    const token = c.req.header("Authorization")?.split(" ")[1];
    if (token) {
      const { err, decoded } = await jwtVerify(token);
      if (err) {
        return c.json({ code: 401, msg: "登录过期", data: {} });
      } else {
        c.set("jwtPayload", decoded);
        await next();
      }
    } else {
      return c.json({ code: 401, msg: "未登录", data: {} });
    }
  });
};

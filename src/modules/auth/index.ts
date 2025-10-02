import { validateFailHandler } from "@/utils/validate-fail-handler";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import pg from "pg";
import { z } from "zod/v4";
import type { LoginRequest, LoginResponse, MeResponse, RefreshTokenResponse, User } from "./model";

export const authApp = new Hono()
  // 登录接口
  .post(
    "/login",
    zValidator(
      "json",
      z.strictObject({
        username: z.string().min(1),
        password: z.string().min(1),
      }),
      validateFailHandler,
    ),
    async c => {
      const { username, password } = c.req.valid("json") as LoginRequest;

      // 查询用户 - 修复表名引用问题
      const queryConf: pg.QueryConfig = {
        text: `SELECT * FROM "user" WHERE data->>'username' = $1`,
        values: [username],
      };
      const res = await c.var.pool.query<User>(queryConf);

      if (res.rows.length === 0) {
        return c.json({ code: 404, msg: "用户不存在", data: {} as LoginResponse });
      }

      const user = res.rows[0];
      const storedPassword = user.data.password;

      // 验证密码（前端传来的已经是密文，直接比较）
      if (storedPassword !== password) {
        return c.json({ code: 401, msg: "用户名或密码错误", data: {} as LoginResponse });
      }

      // 生成 JWT
      const jwtSign = c.get("jwtSign");
      const { token, refresh_token } = jwtSign({ userId: user.id });

      // 返回登录信息
      const loginResponse: LoginResponse = {
        token,
        refresh_token,
        user: {
          id: user.id,
          username: user.data.username,
          email: user.data.email,
          nickname: user.data.nickname,
          role_ids: user.data.role_ids || [],
        },
      };

      return c.json({ code: 200, msg: "登录成功", data: loginResponse });
    },
  )

  // 获取当前用户信息
  .get("/me", async c => {
    const jwtPayload = c.get("jwtPayload");
    if (!jwtPayload) {
      return c.json({ code: 401, msg: "未登录", data: {} as MeResponse });
    }

    // 查询用户信息 - 修复表名引用问题
    const queryConf: pg.QueryConfig = {
      text: `SELECT * FROM "user" WHERE id = $1`,
      values: [jwtPayload.userId],
    };
    const res = await c.var.pool.query<User>(queryConf);

    if (res.rows.length === 0) {
      return c.json({ code: 404, msg: "用户不存在", data: {} as MeResponse });
    }

    const user = res.rows[0];
    const userInfo = {
      id: user.id,
      username: user.data.username,
      email: user.data.email,
      nickname: user.data.nickname,
      role_ids: user.data.role_ids || [],
    };

    return c.json({ code: 200, msg: "success", data: userInfo });
  })
  // 刷新 token
  .post(
    "/refresh",
    zValidator(
      "json",
      z.strictObject({
        refresh_token: z.string(),
      }),
      validateFailHandler,
    ),
    async c => {
      const { refresh_token } = c.req.valid("json");
      const jwtVerify = c.get("jwtVerify");

      // 验证 refresh_token
      const { err, decoded } = await jwtVerify(refresh_token);
      if (err) {
        return c.json({ code: 401, msg: "refresh_token 无效或已过期", data: {} as RefreshTokenResponse });
      }

      // 生成新的 token
      const jwtSign = c.get("jwtSign");
      const { token, refresh_token: new_refresh_token } = jwtSign({ userId: decoded.userId });

      return c.json({
        code: 200,
        msg: "刷新成功",
        data: {
          token,
          refresh_token: new_refresh_token,
        },
      });
    },
  );

export type AuthApp = typeof authApp;

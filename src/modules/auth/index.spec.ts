import { createJwtMiddleware, createJwtSign } from "@/middlewares/jwt";
import { createPgMiddleware } from "@/middlewares/pg";
import { initDB } from "@/utils/init-db";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { hc } from "hono/client";
import { Pool } from "pg";
import { AuthApp, authApp } from "./index";

describe("test auth module", () => {
  const { PORT } = process.env;
  const app = new Hono();

  const pgPool = new Pool();
  app.use(createPgMiddleware(pgPool));
  app.use(createJwtMiddleware());
  app.route("/auth", authApp);

  const server = serve({ fetch: app.fetch, port: Number(PORT) });

  const client = hc<AuthApp>(`http://localhost:${PORT}/auth`);

  // 创建测试用户
  beforeAll(async () => {
    await initDB(pgPool);

    await pgPool.query(
      `
      INSERT INTO "user" (data) VALUES ($1) 
      ON CONFLICT ((data->>'username')) DO NOTHING
    `,
      [
        {
          username: "testuser",
          password: "hashedpassword123",
          email: "test@example.com",
          nickname: "Test User",
        },
      ],
    );
  });
  afterAll(async () => {
    // 清理测试数据
    await pgPool.query(`DELETE FROM "user" WHERE data->>'username' = $1`, ["testuser"]);

    server.close();
    await pgPool.end();
  });

  it("test login with valid credentials", async () => {
    const res = await client.login.$post({
      json: {
        username: "testuser",
        password: "hashedpassword123",
      },
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      const resJSON = await res.json();
      expect(resJSON.code).toBe(200);
      expect(resJSON.data.token).toBeDefined();
      expect(resJSON.data.refresh_token).toBeDefined();
      expect(resJSON.data.user.username).toBe("testuser");
      expect(resJSON.data.user.email).toBe("test@example.com");
      expect(resJSON.data.user.nickname).toBe("Test User");
    }
  });

  it("test login with invalid credentials", async () => {
    const res = await client.login.$post({
      json: {
        username: "testuser",
        password: "wrongpassword",
      },
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      const resJSON = await res.json();
      expect(resJSON.code).toBe(401);
      expect(resJSON.msg).toBe("用户名或密码错误");
    }
  });

  it("test login with non-existent user", async () => {
    const res = await client.login.$post({
      json: {
        username: "nonexistent",
        password: "password",
      },
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      const resJSON = await res.json();
      expect(resJSON.code).toBe(404);
      expect(resJSON.msg).toBe("用户不存在");
    }
  });

  it("test refresh token", async () => {
    // 先登录获取 refresh_token
    const loginRes = await client.login.$post({
      json: {
        username: "testuser",
        password: "hashedpassword123",
      },
    });

    if (loginRes.ok) {
      const loginData = await loginRes.json();
      const refreshRes = await client.refresh.$post({
        json: {
          refresh_token: loginData.data.refresh_token,
        },
      });

      expect(refreshRes.ok).toBe(true);
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        expect(refreshData.code).toBe(200);
        expect(refreshData.data.token).toBeDefined();
        expect(refreshData.data.refresh_token).toBeDefined();
      }
    }
  });

  it("test refresh token with invalid token", async () => {
    const refreshRes = await client.refresh.$post({
      json: {
        refresh_token: "invalid_token",
      },
    });

    expect(refreshRes.ok).toBe(true);
    if (refreshRes.ok) {
      const refreshData = await refreshRes.json();
      expect(refreshData.code).toBe(401);
      expect(refreshData.msg).toBe("refresh_token 无效或已过期");
    }
  });

  it("test get current user info with valid token", async () => {
    // 先登录获取token
    const loginRes = await client.login.$post({
      json: {
        username: "testuser",
        password: "hashedpassword123",
      },
    });

    if (loginRes.ok) {
      const loginData = await loginRes.json();

      // 使用获取到的token调用/me接口
      const meRes = await client.me.$get({
        header: {
          "Authorization": `Bearer ${loginData.data.token}`,
        },
      });

      expect(meRes.ok).toBe(true);
      if (meRes.ok) {
        const meData = await meRes.json();
        expect(meData.code).toBe(200);
        expect(meData.data.username).toBe("testuser");
        expect(meData.data.email).toBe("test@example.com");
        expect(meData.data.nickname).toBe("Test User");
        expect(meData.data.role_ids).toEqual([]);
      }
    }
  });

  it("test get current user info without token", async () => {
    const meRes = await client.me.$get();

    expect(meRes.ok).toBe(true);
    if (meRes.ok) {
      const meData = await meRes.json();
      expect(meData.code).toBe(401);
      expect(meData.msg).toBe("未登录");
    }
  });

  it("test get current user info with invalid token", async () => {
    const meRes = await client.me.$get({
      header: {
        "Authorization": "Bearer invalid_token",
      },
    });

    expect(meRes.ok).toBe(true);
    if (meRes.ok) {
      const meData = await meRes.json();
      expect(meData.code).toBe(401);
    }
  });

  it("test get current user info with non-existent user", async () => {
    // 创建一个不存在的用户ID的token
    const jwtSign = createJwtSign();
    const { token } = jwtSign({ userId: "391c3c08-b887-494a-83c7-edc12345eca8" });

    const meRes = await client.me.$get({
      header: {
        "Authorization": `Bearer ${token}`,
      },
    });

    expect(meRes.ok).toBe(true);
    if (meRes.ok) {
      const meData = await meRes.json();
      expect(meData.code).toBe(404);
      expect(meData.msg).toBe("用户不存在");
    }
  });
});

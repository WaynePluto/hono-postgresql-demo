import { createJwtMiddleware, createJwtSign } from "@/middlewares/jwt";
import { createPgMiddleware } from "@/middlewares/pg";
import { initDB } from "@/utils/init-db";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { hc } from "hono/client";
import pg, { Pool } from "pg";
import { UserApp, userApp } from "./index";
import { User } from "./model";

describe("test user module", () => {
  const { PORT } = process.env;
  const app = new Hono();

  const pgPool = new Pool();
  app.use(createPgMiddleware(pgPool));
  app.use(createJwtMiddleware());
  app.route("/users", userApp);

  const server = serve({ fetch: app.fetch, port: Number(PORT) });

  const client = hc<UserApp>(`http://localhost:${PORT}/users`);

  let testUserId: string;

  let token = "";

  beforeAll(async () => {
    await initDB(pgPool);

    const userCheck: pg.QueryConfig = {
      text: `SELECT id, data FROM "user" WHERE data->>'username' = $1`,
      values: ["administrator"],
    };
    const queryRes = await pgPool.query<User>(userCheck);

    const sign = createJwtSign("jwt");
    const res = await sign({
      userId: queryRes.rows[0].id,
    });
    token = res.token;
  });

  afterAll(async () => {
    // 清理测试数据
    if (testUserId) {
      await pgPool.query(`DELETE FROM "user" WHERE id = $1`, [testUserId]);
    }
    server.close();
    await pgPool.end();
  });

  it("test create user", async () => {
    const res = await client.index.$post(
      {
        json: {
          username: "testuser",
          password: "hashedpassword123",
          email: "test@example.com",
          nickname: "Test User",
          role_ids: ["role1", "role2"],
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    expect(res.ok).toBe(true);
    if (res.ok) {
      const resJSON = await res.json();
      expect(resJSON.code).toBe(200);
      expect(resJSON.data.id).toBeDefined();
      testUserId = resJSON.data.id;
    }
  });

  it("test create user with duplicate username", async () => {
    const res = await client.index.$post(
      {
        json: {
          username: "testuser",
          password: "anotherpassword",
          email: "test2@example.com",
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    expect(res.ok).toBe(true);
    if (res.ok) {
      const resJSON = await res.json();
      expect(resJSON.code).toBe(400);
      expect(resJSON.msg).toBe("用户名已存在");
    }
  });

  it("test get user list", async () => {
    const res = await client.page.$post(
      {
        json: {
          page: 1,
          pageSize: 10,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    expect(res.ok).toBe(true);
    if (res.ok) {
      const resJSON = await res.json();
      expect(resJSON.code).toBe(200);
      expect(resJSON.data.total).toBeGreaterThan(0);
      expect(resJSON.data.list.length).toBeGreaterThan(0);
    }
  });

  it("test get user by id", async () => {
    const res = await client[":id"].$get(
      {
        param: { id: testUserId },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    expect(res.ok).toBe(true);
    if (res.ok) {
      const resJSON = await res.json();
      expect(resJSON.code).toBe(200);
      expect(resJSON.data.id).toBe(testUserId);
      expect(resJSON.data.username).toBe("testuser");
      expect(resJSON.data.email).toBe("test@example.com");
      expect(resJSON.data.nickname).toBe("Test User");
      expect(resJSON.data.role_ids).toEqual(["role1", "role2"]);
    }
  });

  it("test update user", async () => {
    const res = await client[":id"].$put(
      {
        param: { id: testUserId },
        json: {
          nickname: "Updated User",
          email: "updated@example.com",
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    expect(res.ok).toBe(true);
    if (res.ok) {
      const resJSON = await res.json();
      expect(resJSON.code).toBe(200);
      expect(resJSON.data).toBe(1);
    }
  });

  it("test get updated user", async () => {
    const res = await client[":id"].$get(
      {
        param: { id: testUserId },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    expect(res.ok).toBe(true);
    if (res.ok) {
      const resJSON = await res.json();
      expect(resJSON.code).toBe(200);
      expect(resJSON.data.nickname).toBe("Updated User");
      expect(resJSON.data.email).toBe("updated@example.com");
    }
  });

  it("test delete user", async () => {
    const res = await client[":id"].$delete(
      {
        param: { id: testUserId },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    expect(res.ok).toBe(true);
    if (res.ok) {
      const resJSON = await res.json();
      expect(resJSON.code).toBe(200);
      expect(resJSON.data).toBe(1);
    }
  });
});

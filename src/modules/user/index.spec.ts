import { createJwtMiddleware, createJwtSign } from "@/middlewares/jwt";
import { createPgMiddleware } from "@/middlewares/pg";
import { initDB } from "@/utils/init-db";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { hc } from "hono/client";
import pg, { Pool } from "pg";
import { UserApp, userApp } from "./index";

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

  let testCustomUserId: string;

  let customUserToken = "";
  let guestUserToken = "";

  beforeAll(async () => {
    await initDB(pgPool);

    // 创建测试用的自定义角色
    const roleInsertQuery: pg.QueryConfig = {
      text: `INSERT INTO "role" (data) VALUES ($1) RETURNING id`,
      values: [
        {
          name: "用户管理测试角色",
          code: "user_management_test_role",
          description: "用于测试用户管理权限的角色",
          permission_codes: ["user:create", "user:read", "user:update", "user:delete", "user:list"],
          type: "custom",
        },
      ],
    };
    await pgPool.query(roleInsertQuery);

    // 创建测试用的自定义用户（拥有用户管理权限）
    const customUserInsertQuery: pg.QueryConfig = {
      text: `INSERT INTO "user" (data) VALUES ($1) RETURNING id`,
      values: [
        {
          username: "test_custom_user",
          password: "testpassword123",
          email: "test_custom@example.com",
          nickname: "Test Custom User",
          role_codes: ["user_management_test_role"],
        },
      ],
    };
    const customUserRes = await pgPool.query(customUserInsertQuery);
    testCustomUserId = customUserRes.rows[0].id;

    const sign = createJwtSign();
    const customUserSignRes = await sign({
      userId: testCustomUserId,
    });
    customUserToken = customUserSignRes.token;

    // 创建访客用户（权限不足）
    const guestUserInsertQuery: pg.QueryConfig = {
      text: `INSERT INTO "user" (data) VALUES ($1) RETURNING id`,
      values: [
        {
          username: "test_guest_user",
          password: "testpassword123",
          email: "test_guest@example.com",
          nickname: "Test Guest User",
          role_codes: ["guest"],
        },
      ],
    };
    const guestUserRes = await pgPool.query(guestUserInsertQuery);
    const guestUserId = guestUserRes.rows[0].id;

    // 为访客用户生成token
    const guestUserSignRes = await sign({
      userId: guestUserId,
    });
    guestUserToken = guestUserSignRes.token;
  });

  afterAll(async () => {
    // 清理测试数据
    if (testUserId) {
      await pgPool.query(`DELETE FROM "user" WHERE id = $1`, [testUserId]);
    }
    if (testCustomUserId) {
      await pgPool.query(`DELETE FROM "user" WHERE id = $1`, [testCustomUserId]);
    }
    await pgPool.query(`DELETE FROM "user" WHERE data->>'username' = 'test_guest_user'`);
    await pgPool.query(`DELETE FROM "role" WHERE data->>'code' = 'user_management_test_role'`);

    server.close();
    await pgPool.end();
  });

  it("test create user with custom role", async () => {
    const res = await client.index.$post(
      {
        json: {
          username: "testuser",
          password: "hashedpassword123",
          email: "test@example.com",
          nickname: "Test User",
          role_codes: ["role1", "role2"],
        },
      },
      {
        headers: {
          Authorization: `Bearer ${customUserToken}`,
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
          Authorization: `Bearer ${customUserToken}`,
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

  it("test get user list with custom role", async () => {
    const res = await client.page.$post(
      {
        json: {
          page: 1,
          pageSize: 10,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${customUserToken}`,
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

  it("test get user by id with custom role", async () => {
    const res = await client[":id"].$get(
      {
        param: { id: testUserId },
      },
      {
        headers: {
          Authorization: `Bearer ${customUserToken}`,
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
      expect(resJSON.data.role_codes).toEqual(["role1", "role2"]);
    }
  });

  it("test update user with custom role", async () => {
    const res = await client[":id"].$put(
      {
        param: { id: testUserId },
        json: {
          nickname: "Updated User",
          email: "updated@example.com",
          role_codes: ["role1", "role2", "role3"],
        },
      },
      {
        headers: {
          Authorization: `Bearer ${customUserToken}`,
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

  it("test get updated user with custom role", async () => {
    const res = await client[":id"].$get(
      {
        param: { id: testUserId },
      },
      {
        headers: {
          Authorization: `Bearer ${customUserToken}`,
        },
      },
    );

    expect(res.ok).toBe(true);
    if (res.ok) {
      const resJSON = await res.json();
      expect(resJSON.code).toBe(200);
      expect(resJSON.data.nickname).toBe("Updated User");
      expect(resJSON.data.email).toBe("updated@example.com");
      expect(resJSON.data.role_codes).toEqual(["role1", "role2", "role3"]);
    }
  });

  it("test delete user with custom role", async () => {
    const res = await client[":id"].$delete(
      {
        param: { id: testUserId },
      },
      {
        headers: {
          Authorization: `Bearer ${customUserToken}`,
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

  // 权限不足测试
  it("test create user without permission", async () => {
    const res = await client.index.$post(
      {
        json: {
          username: "unauthorized_user",
          password: "password123",
          email: "unauthorized@example.com",
        },
      },
      {
        headers: {
          Authorization: `Bearer ${guestUserToken}`,
        },
      },
    );

    expect(res.ok).toBe(true);
    if (res.ok) {
      const resJSON = await res.json();
      expect(resJSON.code).toBe(403);
      expect(resJSON.msg).toBe("权限不足");
    }
  });

  it("test get user list without permission", async () => {
    const res = await client.page.$post(
      {
        json: {
          page: 1,
          pageSize: 10,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${guestUserToken}`,
        },
      },
    );

    expect(res.ok).toBe(true);
    if (res.ok) {
      const resJSON = await res.json();
      expect(resJSON.code).toBe(403);
      expect(resJSON.msg).toBe("权限不足");
    }
  });

  it("test get user by id without permission", async () => {
    // 使用pg随机生成一个uuid
    const uuidResult = await pgPool.query("SELECT gen_random_uuid() as uuid");
    const randomUUID = uuidResult.rows[0].uuid;

    const res = await client[":id"].$get(
      {
        param: { id: randomUUID },
      },
      {
        headers: {
          Authorization: `Bearer ${guestUserToken}`,
        },
      },
    );

    expect(res.ok).toBe(true);
    if (res.ok) {
      const resJSON = await res.json();
      expect(resJSON.code).toBe(403);
      expect(resJSON.msg).toBe("权限不足");
    }
  });

  it("test update user without permission", async () => {
    // 使用pg随机生成一个uuid
    const uuidResult = await pgPool.query("SELECT gen_random_uuid() as uuid");
    const randomUUID = uuidResult.rows[0].uuid;

    const res = await client[":id"].$put(
      {
        param: { id: randomUUID },
        json: {
          nickname: "Updated Unauthorized User",
        },
      },
      {
        headers: {
          Authorization: `Bearer ${guestUserToken}`,
        },
      },
    );

    expect(res.ok).toBe(true);
    if (res.ok) {
      const resJSON = await res.json();
      expect(resJSON.code).toBe(403);
      expect(resJSON.msg).toBe("权限不足");
    }
  });

  it("test delete user without permission", async () => {
    // 使用pg随机生成一个uuid
    const uuidResult = await pgPool.query("SELECT gen_random_uuid() as uuid");
    const randomUUID = uuidResult.rows[0].uuid;

    const res = await client[":id"].$delete(
      {
        param: { id: randomUUID },
      },
      {
        headers: {
          Authorization: `Bearer ${guestUserToken}`,
        },
      },
    );

    expect(res.ok).toBe(true);
    if (res.ok) {
      const resJSON = await res.json();
      expect(resJSON.code).toBe(403);
      expect(resJSON.msg).toBe("权限不足");
    }
  });
});

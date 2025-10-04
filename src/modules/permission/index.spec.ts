import { createJwtMiddleware, createJwtSign } from "@/middlewares/jwt";
import { createPgMiddleware } from "@/middlewares/pg";
import { initDB } from "@/utils/init-db";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { hc } from "hono/client";
import pg, { Pool } from "pg";
import { PermissionApp, permissionApp } from "./index";

describe("test permission module", () => {
  const { PORT } = process.env;
  const app = new Hono();

  const pgPool = new Pool();
  app.use(createPgMiddleware(pgPool));
  app.use(createJwtMiddleware());
  app.route("/permissions", permissionApp);

  const server = serve({ fetch: app.fetch, port: Number(PORT) });

  const client = hc<PermissionApp>(`http://localhost:${PORT}/permissions`);

  /** 有权限的角色id */
  let hasPermissionRoleId = "";
  /** 有角色的用户id */
  let hasRoleUserId = "";
  /** 有权限的用户token */
  let hasPermissionUserToken = "";

  /** 访客id */
  let guestUserId: string;
  /** 无权限的用户token */
  let guestUserToken = "";

  /** 测试增加功能的权限id */
  let testCreatePermissionId: string;

  beforeAll(async () => {
    await initDB(pgPool);

    // 创建测试用的自定义角色
    const roleInsertQuery: pg.QueryConfig = {
      text: `INSERT INTO "role" (data) VALUES ($1) RETURNING id`,
      values: [
        {
          name: "权限管理测试角色",
          code: "permission_management_test_role",
          description: "用于测试权限管理权限的角色",
          permission_codes: [
            "permission:create",
            "permission:read",
            "permission:update",
            "permission:delete",
            "permission:list",
          ],
          type: "custom",
        },
      ],
    };
    const roleRes = await pgPool.query(roleInsertQuery);
    hasPermissionRoleId = roleRes.rows[0].id;

    // 创建测试用的自定义用户（拥有权限管理权限）
    const customUserInsertQuery: pg.QueryConfig = {
      text: `INSERT INTO "user" (data) VALUES ($1) RETURNING id`,
      values: [
        {
          username: "test_module_permission_custom_user",
          password: "testpassword123",
          email: "test_custom_permission@example.com",
          nickname: "测试用户（有权限管理权限）",
          role_codes: ["permission_management_test_role"],
        },
      ],
    };
    const customUserRes = await pgPool.query(customUserInsertQuery);
    hasRoleUserId = customUserRes.rows[0].id;

    const sign = createJwtSign();
    const customUserSignRes = await sign({
      userId: hasRoleUserId,
    });
    hasPermissionUserToken = customUserSignRes.token;

    // 创建访客用户（权限不足）
    const guestUserInsertQuery: pg.QueryConfig = {
      text: `INSERT INTO "user" (data) VALUES ($1) RETURNING id`,
      values: [
        {
          username: "test_module_permission_guest_user",
          password: "testpassword123",
          email: "test_guest_permission@example.com",
          nickname: "测试用户（无权限管理权限）",
          role_codes: ["guest"],
        },
      ],
    };
    const guestUserRes = await pgPool.query(guestUserInsertQuery);
    guestUserId = guestUserRes.rows[0].id;

    // 为访客用户生成token
    const guestUserSignRes = await sign({
      userId: guestUserId,
    });
    guestUserToken = guestUserSignRes.token;
  });

  afterAll(async () => {
    // 清理测试数据
    if (testCreatePermissionId) {
      await pgPool.query(`DELETE FROM "permission" WHERE id = $1`, [testCreatePermissionId]);
    }
    if (hasRoleUserId || guestUserId) {
      const ids = [hasRoleUserId, guestUserId].filter(id => !!id);
      await pgPool.query(`DELETE FROM "user" WHERE id = ANY($1)`, [ids]);
    }
    if (hasPermissionRoleId) {
      await pgPool.query(`DELETE FROM "role" WHERE id = $1`, [hasPermissionRoleId]);
    }

    server.close();
    await pgPool.end();
  });

  it("test create permission with custom role", async () => {
    const res = await client.index.$post(
      {
        json: {
          name: "Test View Users",
          code: "test_users:view",
          resource: "users",
          description: "Test permission to view users",
          type: "custom",
        },
      },
      {
        headers: {
          Authorization: `Bearer ${hasPermissionUserToken}`,
        },
      },
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      const resJSON = await res.json();
      expect(resJSON.code).toBe(200);
      expect(resJSON.msg).toBe("创建成功");
      expect(resJSON.data.id).toBeDefined();
      testCreatePermissionId = resJSON.data.id;
    }
  });

  it("test create permission without permission", async () => {
    const res = await client.index.$post(
      {
        json: {
          name: "Unauthorized Permission",
          code: "unauthorized:test",
          resource: "users",
          description: "Test permission without authorization",
          type: "custom",
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

  it("test find page with custom role", async () => {
    const res = await client.page.$post(
      {
        json: {
          page: 1,
          pageSize: 10,
          name: "Test View Users",
        },
      },
      {
        headers: {
          Authorization: `Bearer ${hasPermissionUserToken}`,
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

  it("test find page without permission", async () => {
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

  it("test get permission by id with custom role", async () => {
    const res = await client[":id"].$get(
      {
        param: { id: testCreatePermissionId },
      },
      {
        headers: {
          Authorization: `Bearer ${hasPermissionUserToken}`,
        },
      },
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      const resJSON = await res.json();
      expect(resJSON.code).toBe(200);
      expect(resJSON.data.name).toEqual("Test View Users");
      expect(resJSON.data.code).toEqual("test_users:view");
      expect(resJSON.data.description).toEqual("Test permission to view users");
    }
  });

  it("test get permission by id without permission", async () => {
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

  it("test update permission by id with custom role", async () => {
    const res = await client[":id"].$put(
      {
        param: { id: testCreatePermissionId },
        json: {
          name: "Test Manage Users",
          code: "test_users:manage",
          description: "Test permission to manage users",
        },
      },
      {
        headers: {
          Authorization: `Bearer ${hasPermissionUserToken}`,
        },
      },
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      const resJSON = await res.json();
      expect(resJSON.code).toBe(200);
      expect(resJSON.msg).toBe("更新成功");
      expect(resJSON.data).toBe(1);
    }
  });

  it("test update permission by id without permission", async () => {
    // 使用pg随机生成一个uuid
    const uuidResult = await pgPool.query("SELECT gen_random_uuid() as uuid");
    const randomUUID = uuidResult.rows[0].uuid;

    const res = await client[":id"].$put(
      {
        param: { id: randomUUID },
        json: {
          name: "Unauthorized Update",
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

  it("test get updated permission with custom role", async () => {
    const res = await client[":id"].$get(
      {
        param: { id: testCreatePermissionId },
      },
      {
        headers: {
          Authorization: `Bearer ${hasPermissionUserToken}`,
        },
      },
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      const resJSON = await res.json();
      expect(resJSON.code).toBe(200);
      expect(resJSON.data.name).toEqual("Test Manage Users");
      expect(resJSON.data.code).toEqual("test_users:manage");
      expect(resJSON.data.description).toEqual("Test permission to manage users");
    }
  });

  it("test delete permission by id with custom role", async () => {
    const res = await client[":id"].$delete(
      {
        param: { id: testCreatePermissionId },
      },
      {
        headers: {
          Authorization: `Bearer ${hasPermissionUserToken}`,
        },
      },
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      const resJSON = await res.json();
      expect(resJSON.code).toBe(200);
      expect(resJSON.msg).toBe("删除成功");
      expect(resJSON.data).toBe(1);
    }
  });

  it("test delete permission by id without permission", async () => {
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

  it("test get non-existent permission", async () => {
    // 使用pg随机生成一个uuid
    const uuidResult = await pgPool.query("SELECT gen_random_uuid() as uuid");
    const randomUUID = uuidResult.rows[0].uuid;

    const res = await client[":id"].$get(
      {
        param: { id: randomUUID },
      },
      {
        headers: {
          Authorization: `Bearer ${hasPermissionUserToken}`,
        },
      },
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      const resJSON = await res.json();
      expect(resJSON.code).toBe(404);
      expect(resJSON.msg).toBe("权限不存在");
    }
  });
});

import { createJwtMiddleware, createJwtSign } from "@/middlewares/jwt";
import { createPgMiddleware } from "@/middlewares/pg";
import { initDB } from "@/utils/init-db";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { hc } from "hono/client";
import pg, { Pool } from "pg";
import { RoleApp, roleApp } from "./index";

describe("test role module", () => {
  const { PORT } = process.env;
  const app = new Hono();

  const pgPool = new Pool();
  app.use(createPgMiddleware(pgPool));
  app.use(createJwtMiddleware());
  app.route("/roles", roleApp);

  const server = serve({ fetch: app.fetch, port: Number(PORT) });

  const client = hc<RoleApp>(`http://localhost:${PORT}/roles`);

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

  /** 测试增加功能的角色id */
  let testCreateRoleId: string;

  beforeAll(async () => {
    await initDB(pgPool);

    // 创建测试用的自定义角色
    const roleInsertQuery: pg.QueryConfig = {
      text: `INSERT INTO "role" (data) VALUES ($1) RETURNING id`,
      values: [
        {
          name: "角色管理测试角色",
          code: "role_management_test_role",
          description: "用于测试角色管理权限的角色",
          permission_codes: ["role:create", "role:read", "role:update", "role:delete", "role:list"],
          type: "custom",
        },
      ],
    };
    const roleRes = await pgPool.query(roleInsertQuery);
    hasPermissionRoleId = roleRes.rows[0].id;

    // 创建测试用的自定义用户（拥有角色管理权限）
    const customUserInsertQuery: pg.QueryConfig = {
      text: `INSERT INTO "user" (data) VALUES ($1) RETURNING id`,
      values: [
        {
          username: "test_module_role_custom_user",
          password: "testpassword123",
          email: "test_custom_role@example.com",
          nickname: "测试用户（有角色管理权限）",
          role_codes: ["role_management_test_role"],
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
          username: "test_module_role_guest_user",
          password: "testpassword123",
          email: "test_guest_role@example.com",
          nickname: "测试用户（无角色管理权限）",
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
    if (testCreateRoleId) {
      await pgPool.query(`DELETE FROM "role" WHERE id = $1`, [testCreateRoleId]);
    }
    if (hasRoleUserId || guestUserId) {
      const ids = [hasRoleUserId, guestUserId].filter(id => !!id);
      await pgPool.query(`DELETE FROM "user" WHERE id = ANY($1)`, [ids]);
    }
    if (hasPermissionRoleId) {
      await pgPool.query(`DELETE FROM "role" WHERE id = $1`, [hasPermissionRoleId]);
    }
    
    // 清理测试数据
    await pgPool.query(`DELETE FROM role WHERE data->>'code' = 'test_admin'`);
    await pgPool.query(`DELETE FROM role WHERE data->>'code' = 'test_role'`);
    await pgPool.query(`DELETE FROM role WHERE data->>'code' = 'test_super_admin'`);

    server.close();
    await pgPool.end();
  });

  it("test create role with custom role", async () => {
    const res = await client.index.$post(
      {
        json: {
          name: "Test Administrator",
          code: "test_admin",
          description: "Test administrator role with full permissions",
          permission_codes: ["perm1", "perm2"],
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
      testCreateRoleId = resJSON.data.id;
    }
  });

  it("test create role without permission", async () => {
    const res = await client.index.$post(
      {
        json: {
          name: "Unauthorized Role",
          code: "unauthorized:test",
          description: "Test role without authorization",
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
          name: "Test Administrator",
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

  it("test get role by id with custom role", async () => {
    const res = await client[":id"].$get(
      {
        param: { id: testCreateRoleId },
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
      expect(resJSON.data.name).toEqual("Test Administrator");
      expect(resJSON.data.code).toEqual("test_admin");
      expect(resJSON.data.description).toEqual("Test administrator role with full permissions");
      expect(resJSON.data.permission_codes).toEqual(["perm1", "perm2"]);
    }
  });

  it("test get role by id without permission", async () => {
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

  it("test update role by id with custom role", async () => {
    const res = await client[":id"].$put(
      {
        param: { id: testCreateRoleId },
        json: {
          name: "Test Super Administrator",
          code: "test_super_admin",
          description: "Test super administrator role with full permissions",
          permission_codes: ["perm1", "perm2", "perm3"],
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

  it("test update role by id without permission", async () => {
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

  it("test get updated role with custom role", async () => {
    const res = await client[":id"].$get(
      {
        param: { id: testCreateRoleId },
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
      expect(resJSON.data.name).toEqual("Test Super Administrator");
      expect(resJSON.data.code).toEqual("test_super_admin");
      expect(resJSON.data.description).toEqual("Test super administrator role with full permissions");
      expect(resJSON.data.permission_codes).toEqual(["perm1", "perm2", "perm3"]);
    }
  });

  it("test create role with duplicate code", async () => {
    // First create a role
    const res1 = await client.index.$post({
      json: {
        name: "Test Role",
        code: "test_role",
        type: "custom",
      },
    }, {
      headers: {
        Authorization: `Bearer ${hasPermissionUserToken}`,
      },
    });

    expect(res1.ok).toBe(true);

    // Try to create another role with the same code
    const res2 = await client.index.$post({
      json: {
        name: "Another Test Role",
        code: "test_role",
        type: "custom",
      },
    }, {
      headers: {
        Authorization: `Bearer ${hasPermissionUserToken}`,
      },
    });

    expect(res2.ok).toBe(true);
    if (res2.ok) {
      const resJSON = await res2.json();
      expect(resJSON.code).toBe(400);
      expect(resJSON.msg).toBe("角色代码已存在");
    }
  });

  it("test delete role by id with custom role", async () => {
    const res = await client[":id"].$delete(
      {
        param: { id: testCreateRoleId },
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

  it("test delete role by id without permission", async () => {
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

  it("test get non-existent role", async () => {
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
      expect(resJSON.msg).toBe("角色不存在");
    }
  });
});
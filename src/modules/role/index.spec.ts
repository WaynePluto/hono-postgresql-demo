import { createPgMiddleware } from "@/middlewares/pg";
import { initDB } from "@/utils/init-db";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { hc } from "hono/client";
import { Pool } from "pg";
import { RoleApp, roleApp } from "./index";

describe("test role module", () => {
  const { PORT } = process.env;
  const app = new Hono();

  const pgPool = new Pool();
  app.use(createPgMiddleware(pgPool));
  app.route("/roles", roleApp);

  const server = serve({ fetch: app.fetch, port: Number(PORT) });

  const client = hc<RoleApp>(`http://localhost:${PORT}/roles`);

  beforeAll(async () => {
    await initDB(pgPool);
  });

  afterAll(async () => {
    // 清理测试数据
    await pgPool.query(`DELETE FROM role WHERE data->>'code' = 'admin'`);
    await pgPool.query(`DELETE FROM role WHERE data->>'code' = 'test:role'`);
    await pgPool.query(`DELETE FROM role WHERE data->>'code' = 'super_admin'`);
    
    server.close();
    await pgPool.end();
  });

  it("test create role", async () => {
    const res = await client.index.$post({
      json: {
        name: "Administrator",
        code: "admin",
        description: "Administrator role with full permissions",
        permission_ids: ["perm1", "perm2"],
      },
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const resJSON = await res.json();
      expect(resJSON.code).toBe(200);
      expect(resJSON.msg).toBe("创建成功");
      expect(resJSON.data.id).toBeDefined();
    }
  });

  let id = "";
  it("test find page", async () => {
    const res = await client.page.$post({
      json: {
        page: 1,
        pageSize: 10,
        name: "Administrator",
      },
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const resJSON = await res.json();
      expect(resJSON.code).toBe(200);
      expect(resJSON.data.total).toBeGreaterThan(0);
      expect(resJSON.data.list.length).toBeGreaterThan(0);
      id = resJSON.data.list[0].id ?? "";
    }
  });

  it("test get role by id", async () => {
    const res = await client[":id"].$get({ param: { id: id.toString() } });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const resJSON = await res.json();
      expect(resJSON.code).toBe(200);
      expect(resJSON.data.name).toEqual("Administrator");
      expect(resJSON.data.code).toEqual("admin");
      expect(resJSON.data.description).toEqual("Administrator role with full permissions");
      expect(resJSON.data.permission_ids).toEqual(["perm1", "perm2"]);
    }
  });

  it("test update role by id", async () => {
    const res = await client[":id"].$put({
      param: { id: id.toString() },
      json: {
        name: "Super Administrator",
        code: "super_admin",
        description: "Super administrator role with full permissions",
        permission_ids: ["perm1", "perm2", "perm3"],
      },
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const resJSON = await res.json();
      expect(resJSON.code).toBe(200);
      expect(resJSON.msg).toBe("更新成功");
      expect(resJSON.data).toBe(1);
    }
  });

  it("test get updated role", async () => {
    const res = await client[":id"].$get({ param: { id: id.toString() } });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const resJSON = await res.json();
      expect(resJSON.code).toBe(200);
      expect(resJSON.data.name).toEqual("Super Administrator");
      expect(resJSON.data.code).toEqual("super_admin");
      expect(resJSON.data.description).toEqual("Super administrator role with full permissions");
      expect(resJSON.data.permission_ids).toEqual(["perm1", "perm2", "perm3"]);
    }
  });

  it("test create role with duplicate code", async () => {
    // First create a role
    const res1 = await client.index.$post({
      json: {
        name: "Test Role",
        code: "test:role",
      },
    });

    expect(res1.ok).toBe(true);

    // Try to create another role with the same code
    const res2 = await client.index.$post({
      json: {
        name: "Another Test Role",
        code: "test:role",
      },
    });

    expect(res2.ok).toBe(true);
    if (res2.ok) {
      const resJSON = await res2.json();
      expect(resJSON.code).toBe(400);
      expect(resJSON.msg).toBe("角色代码已存在");
    }
  });

  it("test delete role by id", async () => {
    const res = await client[":id"].$delete({ param: { id: id.toString() } });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const resJSON = await res.json();
      expect(resJSON.code).toBe(200);
      expect(resJSON.msg).toBe("删除成功");
      expect(resJSON.data).toBe(1);
    }
  });

  it("test get non-existent role", async () => {
    // 使用pg随机生成一个uuid
    const uuidResult = await pgPool.query("SELECT gen_random_uuid() as uuid");
    const randomUUID = uuidResult.rows[0].uuid;

    const res = await client[":id"].$get({ param: { id: randomUUID } });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const resJSON = await res.json();
      expect(resJSON.code).toBe(404);
      expect(resJSON.msg).toBe("角色不存在");
    }
  });
});
import { createPgMiddleware } from "@/middlewares/pg";
import { initDB } from "@/utils/init-db";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { hc } from "hono/client";
import { Pool } from "pg";
import { PermissionApp, permissionApp } from "./index";

describe("test permission module", () => {
  const { PORT } = process.env;
  const app = new Hono();

  const pgPool = new Pool();
  app.use(createPgMiddleware(pgPool));
  app.route("/permissions", permissionApp);

  const server = serve({ fetch: app.fetch, port: Number(PORT) });

  const client = hc<PermissionApp>(`http://localhost:${PORT}/permissions`);

  beforeAll(async () => {
    await initDB(pgPool);
  });

  afterAll(async () => {
    // 清理测试数据
    await pgPool.query(`DELETE FROM permission WHERE data->>'code' = 'users:view'`);
    await pgPool.query(`DELETE FROM permission WHERE data->>'code' = 'test:permission'`);
    await pgPool.query(`DELETE FROM permission WHERE data->>'code' = 'users:manage'`);
    
    server.close();
    await pgPool.end();
  });

  it("test create permission", async () => {
    const res = await client.index.$post({
      json: {
        name: "View Users",
        code: "users:view",
        description: "Permission to view users",
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
        name: "View Users",
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

  it("test get permission by id", async () => {
    const res = await client[":id"].$get({ param: { id: id.toString() } });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const resJSON = await res.json();
      expect(resJSON.code).toBe(200);
      expect(resJSON.data.name).toEqual("View Users");
      expect(resJSON.data.code).toEqual("users:view");
      expect(resJSON.data.description).toEqual("Permission to view users");
    }
  });

  it("test update permission by id", async () => {
    const res = await client[":id"].$put({
      param: { id: id.toString() },
      json: {
        name: "Manage Users",
        code: "users:manage",
        description: "Permission to manage users",
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

  it("test get updated permission", async () => {
    const res = await client[":id"].$get({ param: { id: id.toString() } });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const resJSON = await res.json();
      expect(resJSON.code).toBe(200);
      expect(resJSON.data.name).toEqual("Manage Users");
      expect(resJSON.data.code).toEqual("users:manage");
      expect(resJSON.data.description).toEqual("Permission to manage users");
    }
  });

  it("test create permission with duplicate code", async () => {
    // First create a permission
    const res1 = await client.index.$post({
      json: {
        name: "Test Permission",
        code: "test:permission",
      },
    });

    expect(res1.ok).toBe(true);

    // Try to create another permission with the same code
    const res2 = await client.index.$post({
      json: {
        name: "Another Test Permission",
        code: "test:permission",
      },
    });

    expect(res2.ok).toBe(true);
    if (res2.ok) {
      const resJSON = await res2.json();
      expect(resJSON.code).toBe(400);
      expect(resJSON.msg).toBe("权限代码已存在");
    }
  });

  it("test delete permission by id", async () => {
    const res = await client[":id"].$delete({ param: { id: id.toString() } });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const resJSON = await res.json();
      expect(resJSON.code).toBe(200);
      expect(resJSON.msg).toBe("删除成功");
      expect(resJSON.data).toBe(1);
    }
  });

  it("test get non-existent permission", async () => {
    // 使用pg随机生成一个uuid
    const uuidResult = await pgPool.query("SELECT gen_random_uuid() as uuid");
    const randomUUID = uuidResult.rows[0].uuid;

    const res = await client[":id"].$get({ param: { id: randomUUID } });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const resJSON = await res.json();
      expect(resJSON.code).toBe(404);
      expect(resJSON.msg).toBe("权限不存在");
    }
  });
});
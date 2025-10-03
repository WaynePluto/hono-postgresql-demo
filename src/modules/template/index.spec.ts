import { createPgMiddleware } from "@/middlewares/pg";
import { initDB } from "@/utils/init-db";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { hc } from "hono/client";
import { Pool } from "pg";
import { TemplateApp, templateApp } from "./index";

describe("test template module", () => {
  const { PORT } = process.env;
  const app = new Hono();

  const pgPool = new Pool();
  app.use(createPgMiddleware(pgPool));
  app.route("/template", templateApp);

  const server = serve({ fetch: app.fetch, port: Number(PORT) });

  const client = hc<TemplateApp>(`http://localhost:${PORT}/template`);

  beforeAll(async () => {
    await initDB(pgPool);
  });

  afterAll(() => {
    server.close();
    pgPool.end();
  });

  it("test create template", async () => {
    const res = await client.index.$post({
      json: {
        name: "Tom",
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

  let id = 0;
  it("test find page", async () => {
    const res = await client.page.$post({
      json: {
        page: 1,
        pageSize: 10,
        keyword: "Tom",
      },
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const resJSON = await res.json();
      expect(resJSON.code).toBe(200);
      expect(resJSON.data.total).toBeGreaterThan(0);
      expect(resJSON.data.list.length).toBeGreaterThan(0);
      id = resJSON.data.list[0].id;
    }
  });

  it("test get template by id", async () => {
    const res = await client[":id"].$get({ param: { id: id.toString() } });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const resJSON = await res.json();
      expect(resJSON.code).toBe(200);
      expect(resJSON.data.name).toEqual("Tom");
    }
  });

  it("test update template by id", async () => {
    const res = await client[":id"].$put({
      param: { id: id.toString() },
      json: {
        name: "Jerry",
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

  it("test get updated template", async () => {
    const res = await client[":id"].$get({ param: { id: id.toString() } });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const resJSON = await res.json();
      expect(resJSON.code).toBe(200);
      expect(resJSON.data.name).toEqual("Jerry");
    }
  });

  it("test delete template by id", async () => {
    const res = await client[":id"].$delete({ param: { id: id.toString() } });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const resJSON = await res.json();
      expect(resJSON.code).toBe(200);
      expect(resJSON.msg).toBe("删除成功");
      expect(resJSON.data).toBe(1);
    }
  });

  it("test get non-existent template", async () => {
    // 使用pg随机生成一个uuid
    const uuidResult = await pgPool.query("SELECT gen_random_uuid() as uuid");
    const randomUUID = uuidResult.rows[0].uuid;

    const res = await client[":id"].$get({ param: { id: randomUUID } });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const resJSON = await res.json();
      expect(resJSON.code).toBe(404);
      expect(resJSON.msg).toBe("模板不存在");
    }
  });
});

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

  it("test add row", async () => {
    const res = await client.index.$post({
      json: {
        name: "Tom",
      },
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const resJSON = await res.json();
      expect(resJSON.code).toBe(200);
      expect(resJSON.data).toBe(1);
    }
  });

  let id = 0;
  it("test find page", async () => {
    const res = await client.page.$post({ json: { page: 1, pageSize: 1 } });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const resJSON = await res.json();
      expect(resJSON.code).toBe(200);
      expect(resJSON.data.total).toBeGreaterThan(0);
      expect(resJSON.data.list.length).toBeLessThanOrEqual(1);
      id = resJSON.data.list[0].id;
    }
  });

  it("test get by id", async () => {
    const res = await client[":id"].$get({ param: { id: id.toString() } });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const resJSON = await res.json();
      expect(resJSON.code).toBe(200);
      expect(resJSON.data.data.name).toEqual("Tom");
    }
  });

  it("test update by id", async () => {
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
      expect(resJSON.data).toBe(1);
    }
  });

  it("test get by id updated", async () => {
    const res = await client[":id"].$get({ param: { id: id.toString() } });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const resJSON = await res.json();
      expect(resJSON.code).toBe(200);
      expect(resJSON.data.data.name).toEqual("Jerry");
    }
  });

  it("test delete by id", async () => {
    const res = await client[":id"].$delete({ param: { id: id.toString() } });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const resJSON = await res.json();
      expect(resJSON.code).toBe(200);
      expect(resJSON.data).toBe(1);
    }
  });
});

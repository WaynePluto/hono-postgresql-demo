import { validateFailHandler } from "@/utils/validate-fail-handler";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import pg from "pg";
import { z } from "zod/v4";
import { Model } from "./model";

export const templateApp = new Hono()
  .post("/", zValidator("json", z.strictObject({ open_id: z.string() }), validateFailHandler), async c => {
    const data = c.req.valid("json");
    const queryConf: pg.QueryConfig = {
      text: `INSERT INTO template (data) VALUES ($1)`,
      values: [data],
    };
    const res = await c.var.pool.query(queryConf);
    return c.json({ code: 200, msg: "success", data: res.rowCount });
  })
  .get("/:id", zValidator("param", z.object({ id: z.string() }), validateFailHandler), async c => {
    const { id } = c.req.valid("param");
    const queryConf: pg.QueryConfig = {
      text: `SELECT * FROM template WHERE id = $1`,
      values: [id],
    };
    const res = await c.var.pool.query<Model>(queryConf);
    return c.json({ code: 200, msg: "success", data: res.rows[0] });
  })
  .put(
    "/:id",
    zValidator("param", z.object({ id: z.string() }), validateFailHandler),
    zValidator("json", z.object({ name: z.string() }), validateFailHandler),
    async c => {
      const { id } = c.req.valid("param");
      const data = c.req.valid("json");
      const queryConf: pg.QueryConfig = {
        text: `UPDATE template SET data = jsonb_set(data, '{name}', $1) WHERE id = $2`,
        values: [JSON.stringify(data.name), id],
      };
      const res = await c.var.pool.query(queryConf);
      return c.json({ code: 200, msg: "success", data: res.rowCount });
    },
  )
  .delete("/:id", zValidator("param", z.object({ id: z.string() }), validateFailHandler), async c => {
    const { id } = c.req.valid("param");
    const queryConf: pg.QueryConfig = {
      text: `DELETE FROM template WHERE id = $1`,
      values: [id],
    };
    const res = await c.var.pool.query(queryConf);
    return c.json({ code: 200, msg: "success", data: res.rowCount });
  })
  .post(
    "/page",
    zValidator("json", z.object({ page: z.number().min(1), pageSize: z.number().min(1) }), validateFailHandler),

    async c => {
      const { page, pageSize } = c.req.valid("json");

      const queryCountRes = await c.var.pool.query(`SELECT COUNT(*) FROM template`);
      const total = Number(queryCountRes.rows[0].count);

      const queryConf: pg.QueryConfig = {
        // 分页查询 按id升序
        text: `SELECT * FROM template ORDER BY id DESC LIMIT $1 OFFSET $2`,
        values: [pageSize, (page - 1) * pageSize],
      };
      const res = await c.var.pool.query<Model>(queryConf);

      return c.json({ code: 200, msg: "success", data: { total, list: res.rows } });
    },
  );

export type TemplateApp = typeof templateApp;

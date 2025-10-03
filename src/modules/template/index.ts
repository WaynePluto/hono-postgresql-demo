import { validateFailHandler } from "@/utils/validate-fail-handler";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import pg from "pg";
import { z } from "zod/v4";
import type { CreateTemplateRequest, Model, TemplateDetailResponse, TemplateListResponse, UpdateTemplateRequest } from "./model";

export const templateApp = new Hono()
  // 创建新模板
  .post(
    "/",
    zValidator(
      "json",
      z.strictObject({
        name: z.string().min(1, "模板名称不能为空"),
      }),
      validateFailHandler,
    ),
    async c => {
      const data = c.req.valid("json") as CreateTemplateRequest;

      const queryConf: pg.QueryConfig = {
        text: `INSERT INTO template (data) VALUES ($1) RETURNING id`,
        values: [data],
      };
      const res = await c.var.pool.query(queryConf);

      return c.json({ code: 200, msg: "创建成功", data: { id: res.rows[0].id } });
    },
  )
  // 获取模板详情
  .get("/:id", zValidator("param", z.object({ id: z.string() }), validateFailHandler), async c => {
    const { id } = c.req.valid("param");

    const queryConf: pg.QueryConfig = {
      text: `SELECT * FROM template WHERE id = $1`,
      values: [id],
    };
    const res = await c.var.pool.query<Model>(queryConf);

    if (res.rows.length === 0) {
      return c.json({ code: 404, msg: "模板不存在", data: {} as TemplateDetailResponse });
    }

    const template = res.rows[0];
    const templateDetail: TemplateDetailResponse = {
      id: template.id,
      name: template.data.name,
      created_at: template.created_at.toJSON(),
      updated_at: template.updated_at.toJSON(),
    };

    return c.json({ code: 200, msg: "success", data: templateDetail });
  })
  // 更新模板
  .put(
    "/:id",
    zValidator("param", z.object({ id: z.string() }), validateFailHandler),
    zValidator(
      "json",
      z.strictObject({
        name: z.string().min(1, "模板名称不能为空").optional(),
      }),
      validateFailHandler,
    ),
    async c => {
      const { id } = c.req.valid("param");
      const updateData = c.req.valid("json") as UpdateTemplateRequest;

      // 检查模板是否存在
      const templateCheck: pg.QueryConfig = {
        text: `SELECT id FROM template WHERE id = $1`,
        values: [id],
      };
      const existingTemplate = await c.var.pool.query(templateCheck);

      if (existingTemplate.rows.length === 0) {
        return c.json({ code: 404, msg: "模板不存在", data: null });
      }

      // 合并现有数据和更新数据
      const updateQuery: pg.QueryConfig = {
        text: `UPDATE template SET data = $1 WHERE id = $2`,
        values: [updateData, id],
      };
      const res = await c.var.pool.query(updateQuery);

      return c.json({ code: 200, msg: "更新成功", data: res.rowCount });
    },
  )
  // 删除模板
  .delete("/:id", zValidator("param", z.object({ id: z.string() }), validateFailHandler), async c => {
    const { id } = c.req.valid("param");

    // 检查模板是否存在
    const templateCheck: pg.QueryConfig = {
      text: `SELECT id FROM template WHERE id = $1`,
      values: [id],
    };
    const existingTemplate = await c.var.pool.query(templateCheck);

    if (existingTemplate.rows.length === 0) {
      return c.json({ code: 404, msg: "模板不存在", data: null });
    }

    const deleteQuery: pg.QueryConfig = {
      text: `DELETE FROM template WHERE id = $1`,
      values: [id],
    };
    const res = await c.var.pool.query(deleteQuery);

    return c.json({ code: 200, msg: "删除成功", data: res.rowCount });
  })
  // 分页获取模板列表
  .post(
    "/page",
    zValidator(
      "json",
      z.object({
        page: z.number().min(1),
        pageSize: z.number().min(1),
        keyword: z.string().optional(),
        name: z.string().optional(),
        orderBy: z.enum(["created_at", "updated_at"]).optional(),
        order: z.enum(["asc", "desc"]).optional(),
      }),
      validateFailHandler,
    ),
    async c => {
      const { page, pageSize, keyword, name, orderBy = "created_at", order = "DESC" } = c.req.valid("json");

      let queryText = `SELECT COUNT(*) FROM template WHERE 1=1`;
      const countValues: any[] = [];
      let paramIndex = 1;

      if (keyword) {
        queryText += ` AND data->>'name' ILIKE $${paramIndex}`;
        countValues.push(`%${keyword}%`);
        paramIndex++;
      }

      if (name) {
        queryText += ` AND data->>'name' ILIKE $${paramIndex}`;
        countValues.push(`%${name}%`);
        paramIndex++;
      }

      const queryCountRes = await c.var.pool.query(queryText, countValues);
      const total = Number(queryCountRes.rows[0].count);

      let listQueryText = `SELECT * FROM template WHERE 1=1`;
      const listValues: any[] = [];
      paramIndex = 1;

      if (keyword) {
        listQueryText += ` AND data->>'name' ILIKE $${paramIndex}`;
        listValues.push(`%${keyword}%`);
        paramIndex++;
      }

      if (name) {
        listQueryText += ` AND data->>'name' ILIKE $${paramIndex}`;
        listValues.push(`%${name}%`);
        paramIndex++;
      }

      listQueryText += ` ORDER BY ${orderBy} ${order} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      listValues.push(pageSize, (page - 1) * pageSize);

      const listRes = await c.var.pool.query<Model>(listQueryText, listValues);

      const templates = listRes.rows.map(template => ({
        id: template.id,
        name: template.data.name,
        created_at: template.created_at.toJSON(),
        updated_at: template.updated_at.toJSON(),
      }));

      return c.json({
        code: 200,
        msg: "success",
        data: {
          total,
          list: templates,
        } as TemplateListResponse,
      });
    },
  );

export type TemplateApp = typeof templateApp;
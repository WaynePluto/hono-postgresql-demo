import { validateFailHandler } from "@/utils/validate-fail-handler";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import pg from "pg";
import { z } from "zod/v4";
import type { CreateRoleRequest, Role, RoleDetailResponse, RoleListResponse, UpdateRoleRequest } from "./model";

export const roleApp = new Hono()
  // 获取角色列表
  .post(
    "/page",
    zValidator(
      "json",
      z.object({
        page: z.number().min(1),
        pageSize: z.number().min(1),
        name: z.string().optional(),
        code: z.string().optional(),
        orderBy: z.enum(["created_at", "updated_at"]).optional(),
        order: z.enum(["asc", "desc"]).optional(),
      }),
      validateFailHandler,
    ),
    async c => {
      const { page, pageSize, name, code, orderBy = "created_at", order = "DESC" } = c.req.valid("json");

      let queryText = `SELECT COUNT(*) FROM role WHERE 1=1`;
      const countValues: any[] = [];
      let paramIndex = 1;

      if (name) {
        queryText += ` AND data->>'name' ILIKE $${paramIndex}`;
        countValues.push(`%${name}%`);
        paramIndex++;
      }

      if (code) {
        queryText += ` AND data->>'code' ILIKE $${paramIndex}`;
        countValues.push(`%${code}%`);
        paramIndex++;
      }

      const queryCountRes = await c.var.pool.query(queryText, countValues);
      const total = Number(queryCountRes.rows[0].count);

      let listQueryText = `SELECT * FROM role WHERE 1=1`;
      const listValues: any[] = [];
      paramIndex = 1;

      if (name) {
        listQueryText += ` AND data->>'name' ILIKE $${paramIndex}`;
        listValues.push(`%${name}%`);
        paramIndex++;
      }

      if (code) {
        listQueryText += ` AND data->>'code' ILIKE $${paramIndex}`;
        listValues.push(`%${code}%`);
        paramIndex++;
      }

      listQueryText += ` ORDER BY ${orderBy} ${order} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      listValues.push(pageSize, (page - 1) * pageSize);

      const listRes = await c.var.pool.query<Role>(listQueryText, listValues);

      const roles = listRes.rows.map(role => ({
        id: role.id,
        name: role.data.name,
        code: role.data.code,
        description: role.data.description,
        permission_codes: role.data.permission_codes || [],
        created_at: role.created_at.toJSON(),
        updated_at: role.updated_at.toJSON(),
      }));

      return c.json({
        code: 200,
        msg: "success",
        data: {
          total,
          list: roles,
        } as RoleListResponse,
      });
    },
  )
  // 获取单个角色详情
  .get("/:id", zValidator("param", z.object({ id: z.string() }), validateFailHandler), async c => {
    const { id } = c.req.valid("param");

    const queryConf: pg.QueryConfig = {
      text: `SELECT * FROM role WHERE id = $1`,
      values: [id],
    };
    const res = await c.var.pool.query<Role>(queryConf);

    if (res.rows.length === 0) {
      return c.json({ code: 404, msg: "角色不存在", data: {} as RoleDetailResponse });
    }

    const role = res.rows[0];
    const roleDetail: RoleDetailResponse = {
      id: role.id,
      name: role.data.name,
      code: role.data.code,
      description: role.data.description,
      permission_codes: role.data.permission_codes || [],
      created_at: role.created_at.toJSON(),
      updated_at: role.updated_at.toJSON(),
    };

    return c.json({ code: 200, msg: "success", data: roleDetail });
  })
  // 创建新角色
  .post(
    "/",
    zValidator(
      "json",
      z.strictObject({
        name: z.string().min(1, "角色名称不能为空"),
        code: z.string().min(1, "角色代码不能为空"),
        description: z.string().optional(),
        permission_codes: z.array(z.string()).optional(),
      }),
      validateFailHandler,
    ),
    async c => {
      const roleData = c.req.valid("json") as CreateRoleRequest;

      // 检查角色代码是否已存在
      const checkQuery: pg.QueryConfig = {
        text: `SELECT id FROM role WHERE data->>'code' = $1`,
        values: [roleData.code],
      };
      const existingRole = await c.var.pool.query(checkQuery);

      if (existingRole.rows.length > 0) {
        return c.json({ code: 400, msg: "角色代码已存在", data: { id: "" } });
      }

      const insertQuery: pg.QueryConfig = {
        text: `INSERT INTO role (data) VALUES ($1) RETURNING id`,
        values: [roleData],
      };
      const res = await c.var.pool.query(insertQuery);

      return c.json({ code: 200, msg: "创建成功", data: { id: res.rows[0].id } });
    },
  )
  // 更新角色信息
  .put(
    "/:id",
    zValidator("param", z.object({ id: z.string() }), validateFailHandler),
    zValidator(
      "json",
      z.strictObject({
        name: z.string().min(1, "角色名称不能为空").optional(),
        code: z.string().min(1, "角色代码不能为空").optional(),
        description: z.string().optional(),
        permission_codes: z.array(z.string()).optional(),
      }),
      validateFailHandler,
    ),
    async c => {
      const { id } = c.req.valid("param");
      const updateData = c.req.valid("json") as UpdateRoleRequest;

      // 检查角色是否存在
      const roleCheck: pg.QueryConfig = {
        text: `SELECT id, data FROM role WHERE id = $1`,
        values: [id],
      };
      const existingRole = await c.var.pool.query<Role>(roleCheck);

      if (existingRole.rows.length === 0) {
        return c.json({ code: 404, msg: "角色不存在", data: null });
      }

      // 如果更新角色代码，检查是否与其他角色重复
      if (updateData.code) {
        const codeCheck: pg.QueryConfig = {
          text: `SELECT id FROM role WHERE data->>'code' = $1 AND id != $2`,
          values: [updateData.code, id],
        };
        const duplicateCode = await c.var.pool.query(codeCheck);

        if (duplicateCode.rows.length > 0) {
          return c.json({ code: 400, msg: "角色代码已存在", data: null });
        }
      }

      // 合并现有数据和更新数据
      const currentData = existingRole.rows[0].data;
      const mergedData = { ...currentData, ...updateData };

      const updateQuery: pg.QueryConfig = {
        text: `UPDATE role SET data = $1 WHERE id = $2`,
        values: [mergedData, id],
      };
      const res = await c.var.pool.query(updateQuery);

      return c.json({ code: 200, msg: "更新成功", data: res.rowCount });
    },
  )
  // 删除角色
  .delete("/:id", zValidator("param", z.object({ id: z.string() }), validateFailHandler), async c => {
    const { id } = c.req.valid("param");

    // 检查角色是否存在
    const roleCheck: pg.QueryConfig = {
      text: `SELECT id FROM role WHERE id = $1`,
      values: [id],
    };
    const existingRole = await c.var.pool.query(roleCheck);

    if (existingRole.rows.length === 0) {
      return c.json({ code: 404, msg: "角色不存在", data: null });
    }

    const deleteQuery: pg.QueryConfig = {
      text: `DELETE FROM role WHERE id = $1`,
      values: [id],
    };
    const res = await c.var.pool.query(deleteQuery);

    return c.json({ code: 200, msg: "删除成功", data: res.rowCount });
  });

export type RoleApp = typeof roleApp;
import { validateFailHandler } from "@/utils/validate-fail-handler";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import pg from "pg";
import { z } from "zod/v4";
import type {
  CreatePermissionRequest,
  Permission,
  PermissionDetailResponse,
  PermissionListResponse,
  UpdatePermissionRequest,
} from "./model";

export const permissionApp = new Hono()
  // 创建新权限
  .post(
    "/",
    zValidator(
      "json",
      z.strictObject({
        name: z.string().min(1, "权限名称不能为空"),
        code: z.string().min(1, "权限代码不能为空"),
        description: z.string().optional(),
      }),
      validateFailHandler,
    ),
    async c => {
      const data = c.req.valid("json") as CreatePermissionRequest;

      // 检查权限代码是否已存在
      const checkQuery: pg.QueryConfig = {
        text: `SELECT id FROM permission WHERE data->>'code' = $1`,
        values: [data.code],
      };
      const existingPermission = await c.var.pool.query(checkQuery);

      if (existingPermission.rows.length > 0) {
        return c.json({ code: 400, msg: "权限代码已存在", data: { id: "" } });
      }

      const queryConf: pg.QueryConfig = {
        text: `INSERT INTO permission (data) VALUES ($1) RETURNING id`,
        values: [data],
      };
      const res = await c.var.pool.query(queryConf);

      return c.json({ code: 200, msg: "创建成功", data: { id: res.rows[0].id } });
    },
  )
  // 获取权限详情
  .get("/:id", zValidator("param", z.object({ id: z.string() }), validateFailHandler), async c => {
    const { id } = c.req.valid("param");

    const queryConf: pg.QueryConfig = {
      text: `SELECT * FROM permission WHERE id = $1`,
      values: [id],
    };
    const res = await c.var.pool.query<Permission>(queryConf);

    if (res.rows.length === 0) {
      return c.json({ code: 404, msg: "权限不存在", data: {} as PermissionDetailResponse });
    }

    const permission = res.rows[0];
    const permissionDetail: PermissionDetailResponse = {
      id: permission.id,
      name: permission.data.name,
      code: permission.data.code,
      description: permission.data.description,
      created_at: permission.created_at.toJSON(),
      updated_at: permission.updated_at.toJSON(),
    };

    return c.json({ code: 200, msg: "success", data: permissionDetail });
  })
  // 更新权限
  .put(
    "/:id",
    zValidator("param", z.object({ id: z.string() }), validateFailHandler),
    zValidator(
      "json",
      z.strictObject({
        name: z.string().min(1, "权限名称不能为空").optional(),
        code: z.string().min(1, "权限代码不能为空").optional(),
        description: z.string().optional(),
      }),
      validateFailHandler,
    ),
    async c => {
      const { id } = c.req.valid("param");
      const updateData = c.req.valid("json") as UpdatePermissionRequest;

      // 检查权限是否存在
      const permissionCheck: pg.QueryConfig = {
        text: `SELECT id FROM permission WHERE id = $1`,
        values: [id],
      };
      const existingPermission = await c.var.pool.query(permissionCheck);

      if (existingPermission.rows.length === 0) {
        return c.json({ code: 404, msg: "权限不存在", data: null });
      }

      // 如果更新权限代码，检查是否与其他权限重复
      if (updateData.code) {
        const codeCheck: pg.QueryConfig = {
          text: `SELECT id FROM permission WHERE data->>'code' = $1 AND id != $2`,
          values: [updateData.code, id],
        };
        const duplicateCode = await c.var.pool.query(codeCheck);

        if (duplicateCode.rows.length > 0) {
          return c.json({ code: 400, msg: "权限代码已存在", data: null });
        }
      }

      // 合并现有数据和更新数据
      const updateQuery: pg.QueryConfig = {
        text: `UPDATE permission SET data = $1 WHERE id = $2`,
        values: [updateData, id],
      };
      const res = await c.var.pool.query(updateQuery);

      return c.json({ code: 200, msg: "更新成功", data: res.rowCount });
    },
  )
  // 删除权限
  .delete("/:id", zValidator("param", z.object({ id: z.string() }), validateFailHandler), async c => {
    const { id } = c.req.valid("param");

    // 检查权限是否存在
    const permissionCheck: pg.QueryConfig = {
      text: `SELECT id FROM permission WHERE id = $1`,
      values: [id],
    };
    const existingPermission = await c.var.pool.query(permissionCheck);

    if (existingPermission.rows.length === 0) {
      return c.json({ code: 404, msg: "权限不存在", data: null });
    }

    const deleteQuery: pg.QueryConfig = {
      text: `DELETE FROM permission WHERE id = $1`,
      values: [id],
    };
    const res = await c.var.pool.query(deleteQuery);

    return c.json({ code: 200, msg: "删除成功", data: res.rowCount });
  })
  // 分页获取权限列表
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

      let queryText = `SELECT COUNT(*) FROM permission WHERE 1=1`;
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

      let listQueryText = `SELECT * FROM permission WHERE 1=1`;
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

      const listRes = await c.var.pool.query<Permission>(listQueryText, listValues);

      const permissions = listRes.rows.map(permission => ({
        id: permission.id,
        name: permission.data.name,
        code: permission.data.code,
        description: permission.data.description,
        created_at: permission.created_at.toJSON(),
        updated_at: permission.updated_at.toJSON(),
      }));

      return c.json({
        code: 200,
        msg: "success",
        data: {
          total,
          list: permissions,
        } as PermissionListResponse,
      });
    },
  );

export type PermissionApp = typeof permissionApp;
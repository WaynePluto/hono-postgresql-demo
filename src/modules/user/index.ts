import { validateFailHandler } from "@/utils/validate-fail-handler";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import pg from "pg";
import { z } from "zod/v4";
import type { CreateUserRequest, UpdateUserRequest, User, UserDetailResponse, UserListResponse } from "./model";

export const userApp = new Hono()
  // 获取用户列表
  .post(
    "/page",
    zValidator(
      "json",
      z.object({
        page: z.number().min(1),
        pageSize: z.number().min(1),
        username: z.string().optional(),
        orderBy: z.enum(["created_at", "updated_at"]).optional(),
        order: z.enum(["asc", "desc"]).optional(),
      }),
      validateFailHandler,
    ),
    async c => {
      const { page, pageSize, username, orderBy = "created_at", order = "DESC" } = c.req.valid("json");

      let queryText = `SELECT COUNT(*) FROM "user" WHERE 1=1`;
      const countValues: any[] = [];
      let paramIndex = 1;

      if (username) {
        queryText += ` AND data->>'username' ILIKE $${paramIndex}`;
        countValues.push(`%${username}%`);
        paramIndex++;
      }

      const queryCountRes = await c.var.pool.query(queryText, countValues);
      const total = Number(queryCountRes.rows[0].count);

      let listQueryText = `SELECT * FROM "user" WHERE 1=1`;
      const listValues: any[] = [];
      paramIndex = 1;

      if (username) {
        listQueryText += ` AND data->>'username' ILIKE $${paramIndex}`;
        listValues.push(`%${username}%`);
        paramIndex++;
      }

      listQueryText += ` ORDER BY ${orderBy} ${order} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      listValues.push(pageSize, (page - 1) * pageSize);

      const listRes = await c.var.pool.query<User>(listQueryText, listValues);

      const users = listRes.rows.map(user => ({
        id: user.id,
        username: user.data.username,
        email: user.data.email,
        nickname: user.data.nickname,
        role_ids: user.data.role_ids || [],
        created_at: user.created_at.toJSON(),
        updated_at: user.updated_at.toJSON(),
      }));

      return c.json({
        code: 200,
        msg: "success",
        data: {
          total,
          list: users,
        } as UserListResponse,
      });
    },
  )
  // 获取单个用户详情
  .get("/:id", zValidator("param", z.object({ id: z.string() }), validateFailHandler), async c => {
    const { id } = c.req.valid("param");

    const queryConf: pg.QueryConfig = {
      text: `SELECT * FROM "user" WHERE id = $1`,
      values: [id],
    };
    const res = await c.var.pool.query<User>(queryConf);

    if (res.rows.length === 0) {
      return c.json({ code: 404, msg: "用户不存在", data: {} as UserDetailResponse });
    }

    const user = res.rows[0];
    const userDetail: UserDetailResponse = {
      id: user.id,
      username: user.data.username,
      email: user.data.email,
      nickname: user.data.nickname,
      role_ids: user.data.role_ids || [],
      created_at: user.created_at.toJSON(),
      updated_at: user.updated_at.toJSON(),
    };

    return c.json({ code: 200, msg: "success", data: userDetail });
  })
  // 创建新用户
  .post(
    "/",
    zValidator(
      "json",
      z.strictObject({
        username: z.string().min(1, "用户名不能为空"),
        password: z.string().min(6, "密码至少6位"),
        email: z.email("邮箱格式不正确").optional(),
        nickname: z.string().optional(),
        role_ids: z.array(z.string()).optional(),
      }),
      validateFailHandler,
    ),
    async c => {
      const userData = c.req.valid("json") as CreateUserRequest;

      // 检查用户名是否已存在
      const checkQuery: pg.QueryConfig = {
        text: `SELECT id FROM "user" WHERE data->>'username' = $1`,
        values: [userData.username],
      };
      const existingUser = await c.var.pool.query(checkQuery);

      if (existingUser.rows.length > 0) {
        return c.json({ code: 400, msg: "用户名已存在", data: { id: "" } });
      }

      // 检查邮箱是否已存在（如果提供了邮箱）
      if (userData.email) {
        const emailCheckQuery: pg.QueryConfig = {
          text: `SELECT id FROM "user" WHERE data->>'email' = $1`,
          values: [userData.email],
        };
        const existingEmail = await c.var.pool.query(emailCheckQuery);

        if (existingEmail.rows.length > 0) {
          return c.json({ code: 400, msg: "邮箱已存在", data: { id: "" } });
        }
      }

      const insertQuery: pg.QueryConfig = {
        text: `INSERT INTO "user" (data) VALUES ($1) RETURNING id`,
        values: [userData],
      };
      const res = await c.var.pool.query(insertQuery);

      return c.json({ code: 200, msg: "创建成功", data: { id: res.rows[0].id } });
    },
  )
  // 更新用户信息
  .put(
    "/:id",
    zValidator("param", z.object({ id: z.string() }), validateFailHandler),
    zValidator(
      "json",
      z.strictObject({
        username: z.string().min(1, "用户名不能为空").optional(),
        email: z.email("邮箱格式不正确").optional(),
        nickname: z.string().optional(),
        role_ids: z.array(z.string()).optional(),
      }),
      validateFailHandler,
    ),
    async c => {
      const { id } = c.req.valid("param");
      const updateData = c.req.valid("json") as UpdateUserRequest;

      // 检查用户是否存在
      const userCheck: pg.QueryConfig = {
        text: `SELECT id, data FROM "user" WHERE id = $1`,
        values: [id],
      };
      const existingUser = await c.var.pool.query<User>(userCheck);

      if (existingUser.rows.length === 0) {
        return c.json({ code: 404, msg: "用户不存在", data: null });
      }

      // 如果更新用户名，检查是否与其他用户重复
      if (updateData.username) {
        const usernameCheck: pg.QueryConfig = {
          text: `SELECT id FROM "user" WHERE data->>'username' = $1 AND id != $2`,
          values: [updateData.username, id],
        };
        const duplicateUsername = await c.var.pool.query(usernameCheck);

        if (duplicateUsername.rows.length > 0) {
          return c.json({ code: 400, msg: "用户名已存在", data: null });
        }
      }

      // 如果更新邮箱，检查是否与其他用户重复
      if (updateData.email) {
        const emailCheck: pg.QueryConfig = {
          text: `SELECT id FROM "user" WHERE data->>'email' = $1 AND id != $2`,
          values: [updateData.email, id],
        };
        const duplicateEmail = await c.var.pool.query(emailCheck);

        if (duplicateEmail.rows.length > 0) {
          return c.json({ code: 400, msg: "邮箱已存在", data: null });
        }
      }

      // 合并现有数据和更新数据
      const currentData = existingUser.rows[0].data;
      const mergedData = { ...currentData, ...updateData };

      const updateQuery: pg.QueryConfig = {
        text: `UPDATE "user" SET data = $1 WHERE id = $2`,
        values: [mergedData, id],
      };
      const res = await c.var.pool.query(updateQuery);

      return c.json({ code: 200, msg: "更新成功", data: res.rowCount });
    },
  )
  // 删除用户
  .delete("/:id", zValidator("param", z.object({ id: z.string() }), validateFailHandler), async c => {
    const { id } = c.req.valid("param");

    // 检查用户是否存在
    const userCheck: pg.QueryConfig = {
      text: `SELECT id FROM "user" WHERE id = $1`,
      values: [id],
    };
    const existingUser = await c.var.pool.query(userCheck);

    if (existingUser.rows.length === 0) {
      return c.json({ code: 404, msg: "用户不存在", data: null });
    }

    const deleteQuery: pg.QueryConfig = {
      text: `DELETE FROM "user" WHERE id = $1`,
      values: [id],
    };
    const res = await c.var.pool.query(deleteQuery);

    return c.json({ code: 200, msg: "删除成功", data: res.rowCount });
  });

export type UserApp = typeof userApp;

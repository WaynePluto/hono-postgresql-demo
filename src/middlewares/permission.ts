import type { Role } from "@/modules/role/model";
import type { User } from "@/modules/user/model";
import { createMiddleware } from "hono/factory";
import type { QueryConfig } from "pg";

/**
 * 权限验证中间件
 * 检查用户是否具有访问特定资源所需的权限
 * @param requiredPermissions 所需权限列表，用户拥有其中任一权限即可访问
 */
export const createPermissionMiddleware = (...requiredPermissions: string[]) => {
  return createMiddleware(async (c, next) => {
    // 从上下文中获取用户ID
    const jwtPayload = c.get("jwtPayload");
    const userId = jwtPayload?.userId;

    if (!userId) {
      return c.json({ code: 401, msg: "用户未登录", data: {} });
    }

    // 查询用户信息
    const userQuery: QueryConfig = {
      text: `SELECT * FROM "user" WHERE id = $1`,
      values: [userId],
    };
    const userResult = await c.var.pool.query<User>(userQuery);

    if (userResult.rows.length === 0) {
      return c.json({ code: 404, msg: "用户不存在", data: {} });
    }

    const user = userResult.rows[0];
    const userRoleCodes = user.data.role_codes || [];

    // 如果用户没有角色，直接拒绝访问
    if (userRoleCodes.length === 0) {
      return c.json({ code: 403, msg: "权限不足", data: {} });
    }

    // 检查是否为超级管理员角色
    const isSuperAdmin = userRoleCodes.includes("super_admin");
    if (isSuperAdmin) {
      // 超级管理员拥有所有权限
      await next();
      return;
    }

    // 查询用户所有角色信息
    const roleQuery: QueryConfig = {
      text: `SELECT * FROM "role" WHERE data->>'code' = ANY($1)`,
      values: [userRoleCodes],
    };
    const roleResult = await c.var.pool.query<Role>(roleQuery);

    // 获取用户所有权限code
    const userPermissions = new Set<string>();
    for (const role of roleResult.rows) {
      const permissions = role.data.permission_codes || [];
      permissions.forEach(perm => userPermissions.add(perm));
    }

    // 检查用户是否有任一所需权限
    const hasPermission = requiredPermissions.some(perm => userPermissions.has(perm));

    if (!hasPermission) {
      return c.json({ code: 403, msg: "权限不足", data: {} });
    }

    await next();
  });
};

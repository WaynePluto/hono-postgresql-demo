import { CreateUserRequest } from "@/modules/user/model";
import { Pool } from "pg";
import { defaultPermissions, defaultRoles } from "./default-data";

export async function initDB(pool: Pool) {
  await createTable(pool, "template");
  await createTable(pool, "user"); // 添加用户表
  await createUserIndex(pool);
  // 添加管理员账号
  await createAdminUser(pool);

  // 添加权限表和角色表
  await createTable(pool, "permission");
  await createPermissionIndex(pool);
  await createTable(pool, "role");
  await createRoleIndex(pool);

  // 添加默认权限和角色
  await createDefaultPermissions(pool);
  await createDefaultRoles(pool);

  return;
}

/**
 * Create table if not exists
 * @param pool
 * @param tableName
 * @returns
 */
function createTable(pool: Pool, tableName: string) {
  const initSql = `-- 创建表
CREATE TABLE IF NOT EXISTS "${tableName}" (
    id UUID DEFAULT uuidv7() PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    data JSONB
);

-- 创建触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'trigger_update_updated_at_${tableName}'
          AND tgrelid = '${tableName}'::regclass
    ) THEN
        CREATE TRIGGER trigger_update_updated_at_${tableName}
            BEFORE UPDATE ON "${tableName}"
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;`;

  return pool.query(initSql);
}

function createUserIndex(pool: Pool) {
  return pool.query(`
-- 为用户名创建唯一索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_username ON "user" ((data->>'username'));
-- 为邮箱创建唯一索引（如果存在）
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_email ON "user" ((data->>'email')) WHERE data->>'email' IS NOT NULL;
`);
}

function createPermissionIndex(pool: Pool) {
  return pool.query(`
-- 为权限代码创建唯一索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_permission_code ON permission ((data->>'code'));
-- 为权限名称创建索引以支持模糊查询
CREATE INDEX IF NOT EXISTS idx_permission_name ON permission ((data->>'name'));
-- 为权限类型创建索引以提升按类型查询的性能
CREATE INDEX IF NOT EXISTS idx_permission_type ON permission ((data->>'type'));
`);
}

function createRoleIndex(pool: Pool) {
  return pool.query(`
-- 为角色代码创建唯一索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_role_code ON role ((data->>'code'));
-- 为角色名称创建索引以支持模糊查询
CREATE INDEX IF NOT EXISTS idx_role_name ON role ((data->>'name'));
-- 为角色类型创建索引以提升按类型查询的性能
CREATE INDEX IF NOT EXISTS idx_role_type ON role ((data->>'type'));
`);
}

/**
 * 创建一个admin用户
 */
function createAdminUser(pool: Pool) {
  const adminUser: CreateUserRequest = {
    username: "administrator",
    password: "e10adc3949ba59abbe56e057f20f883e",
    email: "admin@example.com",
    nickname: "管理员",
    role_codes: [defaultRoles[0].code],
  };

  return pool.query(`INSERT INTO "user" (data) VALUES ($1) ON CONFLICT DO NOTHING`, [adminUser]);
}

/**
 * 创建默认权限
 */
async function createDefaultPermissions(pool: Pool) {
  // 先删除所有系统类型的权限
  await pool.query(`DELETE FROM permission WHERE data->>'type' = 'system'`);

  // 插入默认权限（系统类型）
  for (const perm of defaultPermissions) {
    await pool.query(`INSERT INTO permission (data) VALUES ($1)`, [perm]);
  }
}

/**
 * 创建默认角色
 */
async function createDefaultRoles(pool: Pool) {
  // 先删除所有系统类型的角色
  await pool.query(`DELETE FROM role WHERE data->>'type' = 'system'`);

  // 插入默认角色（系统类型）
  for (const role of defaultRoles) {
    await pool.query(`INSERT INTO role (data) VALUES ($1)`, [role]);
  }
}

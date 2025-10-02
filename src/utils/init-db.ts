import { Pool } from "pg";

export async function initDB(pool: Pool) {
  await createTable(pool, "template");
  await createTable(pool, "user"); // 添加用户表
  await createUserIndex(pool);
  await createAdminUser(pool);
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
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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

/**
 * 创建一个admin用户
 */
function createAdminUser(pool: Pool) {
  const adminUser = {
    username: "administrator",
    password: "password",
    email: "admin@example.com",
    nickname: "管理员",
    role_ids: ["admin"],
  };

  return pool.query(`INSERT INTO "user" (data) VALUES ($1) ON CONFLICT DO NOTHING`, [adminUser]);
}

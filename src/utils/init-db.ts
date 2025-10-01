import { Pool } from "pg";

export async function initDB(pool: Pool) {
  await createTable(pool, "template");
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
CREATE TABLE IF NOT EXISTS ${tableName} (
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
        WHERE tgname = 'trigger_update_updated_at'
          AND tgrelid = '${tableName}'::regclass
    ) THEN
        CREATE TRIGGER trigger_update_updated_at
            BEFORE UPDATE ON ${tableName}
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;`;

  return pool.query(initSql);
}

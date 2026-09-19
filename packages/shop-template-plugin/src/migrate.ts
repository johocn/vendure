import { DataSource } from 'typeorm';
import { Logger } from '@vendure/core';

const loggerCtx = 'ShopTemplatePlugin';

/** 幂等建表：生产关闭 synchronize 时显式创建 shop_template_version */
export async function ensureVersionTable(ds: DataSource): Promise<void> {
    const driver = ds.options.type;
    try {
        const qb = (sql: string) => ds.query(sql);
        if (driver === 'postgres') {
            await qb(`CREATE TABLE IF NOT EXISTS "shop_template_version" (
                "id" SERIAL PRIMARY KEY,
                "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
                "templateId" integer NOT NULL,
                "version" integer NOT NULL,
                "name" character varying,
                "theme" text,
                "pages" text,
                "enabled" boolean NOT NULL DEFAULT true,
                "note" character varying
            )`);
            await qb(`CREATE INDEX IF NOT EXISTS "idx_shop_template_version_templateId" ON "shop_template_version" ("templateId")`);
        } else {
            await qb(`CREATE TABLE IF NOT EXISTS "shop_template_version" (
                "id" integer PRIMARY KEY AUTOINCREMENT,
                "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
                "updatedAt" datetime NOT NULL DEFAULT (datetime('now')),
                "templateId" integer NOT NULL,
                "version" integer NOT NULL,
                "name" varchar,
                "theme" text,
                "pages" text,
                "enabled" boolean NOT NULL DEFAULT 1,
                "note" varchar
            )`);
            await qb(`CREATE INDEX IF NOT EXISTS "idx_shop_template_version_templateId" ON "shop_template_version" ("templateId")`);
        }
        Logger.info('shop_template_version 表就绪', loggerCtx);
    } catch (e: any) {
        Logger.warn(`shop_template_version 建表失败(忽略): ${e.message}`, loggerCtx);
    }
}

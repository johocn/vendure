// §97（2026-10-31）：售后知识库——快捷回复模板分类、关键词检索与排序。
// 生产 synchronize: false，启动幂等补列（IF NOT EXISTS，重复启动安全）。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

export const p27AfterSalesTemplateCategorySql = `
ALTER TABLE campus_after_sales_reply_template ADD COLUMN IF NOT EXISTS category varchar(50);
ALTER TABLE campus_after_sales_reply_template ADD COLUMN IF NOT EXISTS keywords varchar(200);
ALTER TABLE campus_after_sales_reply_template ADD COLUMN IF NOT EXISTS "sortOrder" integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS campus_after_sales_reply_template_category
  ON campus_after_sales_reply_template ("channelId", category);
`;

@Injectable()
export class P27AfterSalesTemplateCategoryMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of p27AfterSalesTemplateCategorySql.split(';').map(s => s.trim()).filter(Boolean)) {
                    await qr.query(statement);
                }
            } finally {
                await qr.release();
            }
        } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error('[P27AfterSalesTemplateCategoryMigration] failed:', e?.message);
        }
    }
}

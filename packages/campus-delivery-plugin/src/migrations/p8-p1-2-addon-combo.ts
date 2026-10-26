// P1-2 批次（2026-10-26）：套餐/组合商品 + 加料（小料）。
// 生产 synchronize: false，启动幂等补列（IF NOT EXISTS，重复启动安全）。
// 物理列名规则：customFields + 字段名首字母大写、其余小写 → waimaiAddonGroups ⇒ customFieldsWaimaiaddongroups。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

/** 商品级：加料组 JSON + 套餐内容 JSON */
export const p8P1_2ProductSql = `
ALTER TABLE product ADD COLUMN IF NOT EXISTS "customFieldsWaimaiaddongroups" text;
ALTER TABLE product ADD COLUMN IF NOT EXISTS "customFieldsWaimaicombo" text;
`;

/** 订单行级：加料选择快照 JSON */
export const p8P1_2OrderLineSql = `
ALTER TABLE order_line ADD COLUMN IF NOT EXISTS "customFieldsWaimaiaddons" text;
`;

@Injectable()
export class P8P1AddonComboMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const sql of [p8P1_2ProductSql, p8P1_2OrderLineSql]) {
                    for (const statement of sql.split(';').map(s => s.trim()).filter(Boolean)) {
                        await qr.query(statement);
                    }
                }
            } finally {
                await qr.release();
            }
        } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error('[P8P1AddonComboMigration] failed:', e?.message);
        }
    }
}

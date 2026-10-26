// P1-1 批次（2026-10-26）：打包费/餐盒费。
// 生产 synchronize: false，启动幂等补列（IF NOT EXISTS，重复启动安全）。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

/** 店铺级打包费配置（campus_fulfillment_config） */
export const p8P1PackingFeeSql = `
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "packingFeeEnabled" boolean NOT NULL DEFAULT false;
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "packingFeeMode" varchar(16) NOT NULL DEFAULT 'perItem';
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "packingFeeAmount" int NOT NULL DEFAULT 0;
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "packingFeeCap" int;
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "packingFeeLabel" varchar(32);
`;

/** 商品级覆盖：Product.waimaiPackingFee（分/件）→ 物理列 customFieldsWaimaipackingfee */
export const p8P1ProductPackingFeeSql = `
ALTER TABLE product ADD COLUMN IF NOT EXISTS "customFieldsWaimaipackingfee" int;
`;

@Injectable()
export class P8P1PackingFeeMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const sql of [p8P1PackingFeeSql, p8P1ProductPackingFeeSql]) {
                    for (const statement of sql.split(';').map(s => s.trim()).filter(Boolean)) {
                        await qr.query(statement);
                    }
                }
            } finally {
                await qr.release();
            }
        } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error('[P8P1PackingFeeMigration] failed:', e?.message);
        }
    }
}

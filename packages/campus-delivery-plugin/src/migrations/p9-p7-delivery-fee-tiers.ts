// P3-4 批次（2026-10-27）：配送费阶梯计价（按订单商品金额分档替换分区基价）。
// 生产 synchronize: false，启动幂等补列（IF NOT EXISTS，重复启动安全）。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

export const p9P7DeliveryFeeTiersSql = `
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "deliveryFeeTiers" jsonb;
`;

@Injectable()
export class P9P7DeliveryFeeTiersMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of p9P7DeliveryFeeTiersSql.split(';').map(s => s.trim()).filter(Boolean)) {
                    await qr.query(statement);
                }
            } finally {
                await qr.release();
            }
        } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error('[P9P7DeliveryFeeTiersMigration] failed:', e?.message);
        }
    }
}

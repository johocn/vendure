// 为 3 处高频查询补索引（全部幂等 CREATE INDEX IF NOT EXISTS，兼容生产 PostgreSQL
// 与本地开发 SQLite，出错只打日志不抛错，不阻塞启动，等待下次启动重试）。
//  - product_coupon_binding("couponTemplateId")   -> 结算 listByTemplate 用
//  - coupon_template("claimCode")                 -> 普通索引（非唯一），claimCode 同租户内唯一由 service 层保证
//  - customer_coupon("customerId", "templateId")  -> countHeld 用
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

@Injectable()
export class AddCouponIndexes20260919 implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const metadata = this.connection.getMetadata('ProductCouponBinding');
            const tableName = metadata.tableName;
            const queryRunner = this.connection.createQueryRunner();
            try {
                const indexes = [
                    // 结算按券模板查询绑定关系
                    `CREATE INDEX IF NOT EXISTS idx_binding_template ON "${tableName}" ("couponTemplateId")`,
                ];
                for (const sql of indexes) {
                    await queryRunner.query(sql);
                }
                await queryRunner.query(
                    `CREATE INDEX IF NOT EXISTS idx_coupon_template_claim_code ON coupon_template ("claimCode")`,
                );
                await queryRunner.query(
                    `CREATE INDEX IF NOT EXISTS idx_customer_coupon_customer_template ON customer_coupon ("customerId", "templateId")`,
                );
            } finally {
                await queryRunner.release();
            }
        } catch (e: any) {
            // 补索引失败不阻塞启动，等待下次启动重试
            // eslint-disable-next-line no-console
            console.error('[AddCouponIndexes20260919] failed to ensure indexes:', e?.message);
        }
    }
}
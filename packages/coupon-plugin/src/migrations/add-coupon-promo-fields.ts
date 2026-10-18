// 券店营销扩展（首购立减 + 学生价）幂等迁移：
// - coupon_template.studentPrice（学生价，分）
// - coupon_sale_order.discountType / discountAmount（让利记录）
// - channel.firstBuyDiscount（首购立减，分，customFields）
// - customer.studentStatus / studentInfo / studentReviewedAt（学生认证 customFields）
// 每列逐个 hasColumn 判断后 addColumn；失败只打日志不抛错，不阻塞启动，等待下次启动重试。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection, TableColumn } from 'typeorm';

@Injectable()
export class AddCouponPromoFieldsMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            // 通过实体元数据解析真实表名（兼容表前缀），缺实体则整体跳过
            const tableName = (entityName: string): string | null => {
                try {
                    return this.connection.getMetadata(entityName).tableName;
                } catch {
                    return null;
                }
            };
            const tpl = tableName('CouponTemplate');
            const sale = tableName('CouponSaleOrder');
            const channel = tableName('Channel');
            const customer = tableName('Customer');
            const queryRunner = this.connection.createQueryRunner();
            try {
                const plan: Array<[string | null, TableColumn]> = [
                    [tpl, new TableColumn({ name: 'studentPrice', type: 'integer', isNullable: true })],
                    [sale, new TableColumn({ name: 'discountType', type: 'varchar', isNullable: true })],
                    [sale, new TableColumn({ name: 'discountAmount', type: 'integer', isNullable: true })],
                    [channel, new TableColumn({ name: 'firstBuyDiscount', type: 'integer', isNullable: true })],
                    [customer, new TableColumn({ name: 'studentStatus', type: 'varchar', isNullable: true })],
                    [customer, new TableColumn({ name: 'studentInfo', type: 'varchar', isNullable: true })],
                    [customer, new TableColumn({ name: 'studentReviewedAt', type: 'datetime', isNullable: true })],
                ];
                for (const [table, column] of plan) {
                    if (!table) continue;
                    if (!(await queryRunner.hasColumn(table, column.name))) {
                        await queryRunner.addColumn(table, column);
                    }
                }
            } finally {
                await queryRunner.release();
            }
        } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error('[AddCouponPromoFieldsMigration] failed to ensure columns:', e?.message);
        }
    }
}

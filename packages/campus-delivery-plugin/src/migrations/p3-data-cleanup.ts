// P3 数据卫生（2026-10-23）：
// 1) 新增「改址成功」通知模板配置列（生产关闭 synchronize，启动幂等补列）
// 2) 清理无人消费的订单级快递费用字段列 customFieldsthirdpartyfee（第三方运费快照，
//    全仓无查询/报表/对端读取；门店级运费基数 thirdPartyBaseFee 不受影响）
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

export const p3DataCleanupSql = `
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "notifyTemplateAddressChanged" varchar;
ALTER TABLE "order" DROP COLUMN IF EXISTS "customFieldsthirdpartyfee";
`;

@Injectable()
export class P3DataCleanupMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const queryRunner = this.connection.createQueryRunner();
            try {
                await queryRunner.query(p3DataCleanupSql);
            } finally {
                await queryRunner.release();
            }
        } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error('[P3DataCleanupMigration] failed:', e?.message);
        }
    }
}

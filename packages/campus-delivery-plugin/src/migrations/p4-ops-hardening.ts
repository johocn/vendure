// P4 履约加固（2026-10-23）：超时赔付回扫窗口可配（生产关闭 synchronize，启动幂等补列）
// P5 终态补偿（2026-10-24）：历史送达单 hallStatus 未同步（骑手送达只写 deliveryStatus）→ 幂等回填
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

export const p4OpsHardeningSql = `
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "timeoutCompensationWindowHours" integer NOT NULL DEFAULT 24;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "customFieldsExceptionreportedat" timestamp;
UPDATE "order" SET "customFieldsHallstatus" = 'delivered'
WHERE "customFieldsDeliverystatus" = 'delivered'
  AND "customFieldsHallstatus" IS NOT NULL
  AND "customFieldsHallstatus" NOT IN ('delivered', 'cancelled', 'no_rider_final', 'exception_final');
`;

@Injectable()
export class P4OpsHardeningMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const queryRunner = this.connection.createQueryRunner();
            try {
                await queryRunner.query(p4OpsHardeningSql);
            } finally {
                await queryRunner.release();
            }
        } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error('[P4OpsHardeningMigration] failed:', e?.message);
        }
    }
}

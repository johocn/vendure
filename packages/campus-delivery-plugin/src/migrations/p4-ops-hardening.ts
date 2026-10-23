// P4 履约加固（2026-10-23）：超时赔付回扫窗口可配（生产关闭 synchronize，启动幂等补列）
// P5 终态补偿（2026-10-24）：历史送达单 hallStatus 未同步（骑手送达只写 deliveryStatus）→ 幂等回填
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

export const p4OpsHardeningSql = `
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "timeoutCompensationWindowHours" integer NOT NULL DEFAULT 24;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "customFieldsExceptionreportedat" timestamp;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "customFieldsSlotlocked" boolean DEFAULT false;
-- 时段锁位标记回填：在途预约单视为已锁位（历史未落标记），避免其取消时无法归还容量
UPDATE "order" SET "customFieldsSlotlocked" = true
WHERE "customFieldsDeliveryslotid" IS NOT NULL
  AND COALESCE("customFieldsSlotlocked", false) = false
  AND "customFieldsHallstatus" IN ('scheduled', 'pending_merchant', 'accepted', 'open', 'pending_dispatch', 'third_party', 'owned_pool', 'owned_dispatched', 'merchant_delivering', 'grabbed');
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

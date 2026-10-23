// 改址台账结清凭证（2026-10-23）：补收备注 + 实际退款单 id
// IF NOT EXISTS 幂等，生产关闭 synchronize 时启动补列。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

export const addAddressChangeSettleProofSql = `
ALTER TABLE campus_address_change ADD COLUMN IF NOT EXISTS "settleNote" varchar;
ALTER TABLE campus_address_change ADD COLUMN IF NOT EXISTS "refundId" int;
`;

@Injectable()
export class AddAddressChangeSettleProofMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const queryRunner = this.connection.createQueryRunner();
            try {
                await queryRunner.query(addAddressChangeSettleProofSql);
            } finally {
                await queryRunner.release();
            }
        } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error('[AddAddressChangeSettleProofMigration] failed:', e?.message);
        }
    }
}

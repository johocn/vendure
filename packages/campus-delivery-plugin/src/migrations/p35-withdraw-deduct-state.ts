// R1 提现原子化：提现申请新增扣款对账状态（intent/confirmed/deduct_failed）。
// 余额流水 remark 写入 withdraw:<id> 作为对账锚点（recharge-card 插件无需改表）。
// 物理列名规则：customFields 之外字段直接使用属性名；历史行默认 confirmed（旧流程先扣款后落库）。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

export const p35WithdrawDeductStateSql = `
ALTER TABLE rider_withdrawal_request
    ADD COLUMN IF NOT EXISTS "withdrawState" varchar DEFAULT 'confirmed';
`;

@Injectable()
export class P35WithdrawDeductStateMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of p35WithdrawDeductStateSql
                    .split(';')
                    .map(s => s.trim())
                    .filter(Boolean)) {
                    await qr.query(statement);
                }
            } finally {
                await qr.release();
            }
        } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error('[P35WithdrawDeductStateMigration] failed:', e?.message);
        }
    }
}

// 第三方到校配送基价（2026-10-23）：动态计价覆盖 R2 外部快递到校场景。
// null = 不接管顾客侧运费（沿用店铺普通快递运费），避免存量店铺被强制改价。
// 生产 PostgreSQL 可能关闭 synchronize，故启动时补列；IF NOT EXISTS 幂等，重复启动无副作用。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

export const addThirdPartyBaseFeeSql = `
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "thirdPartyBaseFee" int;
`;

@Injectable()
export class AddThirdPartyBaseFeeMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const queryRunner = this.connection.createQueryRunner();
            try {
                await queryRunner.query(addThirdPartyBaseFeeSql);
            } finally {
                await queryRunner.release();
            }
        } catch (e: any) {
            // 表尚未建立（首次安装先跑建表）等情况只打日志，等待下次启动重试
            // eslint-disable-next-line no-console
            console.error('[AddThirdPartyBaseFeeMigration] failed:', e?.message);
        }
    }
}

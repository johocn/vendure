// R1–R5 履约矩阵新增列（2026-10-23）：按路线第一段承运、校园交接点、外部快递门店编号、超时兜底、门店坐标。
// 生产 PostgreSQL 可能关闭 synchronize，故启动时补列；IF NOT EXISTS 幂等，重复启动无副作用。
// 订单侧 customFields（deliveryPlan/handoverMode/thirdParty*/handoverPoint*）由 Vendure customFields 同步负责，不在此处猜列名。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

export const addRouteDeliveryConfigSql = `
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "routeFirstLeg" jsonb;
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "handoverPoints" jsonb;
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "providerShopNo" jsonb;
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "merchantAcceptMinutes" int DEFAULT 5;
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "externalPushTimeoutMinutes" int DEFAULT 10;
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "externalFallbackMinutes" int DEFAULT 20;
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "storeLat" double precision;
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "storeLng" double precision;
`;

@Injectable()
export class AddRouteDeliveryConfigMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const queryRunner = this.connection.createQueryRunner();
            try {
                await queryRunner.query(addRouteDeliveryConfigSql);
            } finally {
                await queryRunner.release();
            }
        } catch (e: any) {
            // 表尚未建立（首次安装先跑建表）等情况只打日志，等待下次启动重试
            // eslint-disable-next-line no-console
            console.error('[AddRouteDeliveryConfigMigration] failed:', e?.message);
        }
    }
}

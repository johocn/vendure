// 改址 + 动态计价新增结构（2026-10-23）：
// 1) 台账表 campus_address_change（多退少补流水）
// 2) campus_fulfillment_config.dynamicPricing（动态计价 JSON 配置）
// 3) order."customFieldsDeliverydetail"（改址后的门牌/详细地址，覆盖下单地址展示）
// IF NOT EXISTS 幂等，生产关闭 synchronize 时启动补列/补表。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

export const addAddressChangePricingSql = `
CREATE TABLE IF NOT EXISTS campus_address_change (
    "id" serial PRIMARY KEY,
    "createdAt" timestamp NOT NULL DEFAULT now(),
    "updatedAt" timestamp NOT NULL DEFAULT now(),
    "channelId" int NOT NULL,
    "orderId" int NOT NULL,
    "orderCode" varchar NOT NULL,
    "customerId" int,
    "fromZone" varchar NOT NULL,
    "fromBuilding" varchar NOT NULL,
    "fromDetail" varchar,
    "toZone" varchar NOT NULL,
    "toBuilding" varchar NOT NULL,
    "toDetail" varchar,
    "oldFee" int NOT NULL DEFAULT 0,
    "newFee" int NOT NULL DEFAULT 0,
    "diff" int NOT NULL DEFAULT 0,
    "status" varchar NOT NULL DEFAULT 'pending',
    "settledAt" timestamp,
    "settledBy" int,
    "settleAction" varchar
);
CREATE INDEX IF NOT EXISTS idx_campus_address_change_channel ON campus_address_change ("channelId", "status");
CREATE INDEX IF NOT EXISTS idx_campus_address_change_order ON campus_address_change ("orderId");
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "dynamicPricing" jsonb;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "customFieldsDeliverydetail" varchar;
`;

/** 改址台账增补：来源/原因/操作人（2026-10-23 运营代改址） */
export const addAddressChangeActorSql = `
ALTER TABLE campus_address_change ADD COLUMN IF NOT EXISTS "source" varchar;
ALTER TABLE campus_address_change ADD COLUMN IF NOT EXISTS "reason" varchar;
ALTER TABLE campus_address_change ADD COLUMN IF NOT EXISTS "changedBy" int;
`;

@Injectable()
export class AddAddressChangePricingMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const queryRunner = this.connection.createQueryRunner();
            try {
                await queryRunner.query(addAddressChangePricingSql);
                await queryRunner.query(addAddressChangeActorSql);
            } finally {
                await queryRunner.release();
            }
        } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error('[AddAddressChangePricingMigration] failed:', e?.message);
        }
    }
}

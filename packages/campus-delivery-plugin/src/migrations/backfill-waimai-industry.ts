// 外卖准入存量刷数（设计文档 2026-10-09 §4.3）：把已配履约配置的渠道批量置为餐饮行业，
// 避免上线行业过滤后存量外卖店从外卖首页消失。幂等：仅当 industryType 为空时写入。
// 列名 customFieldsIndustrytype 为 Vendure customFields 同步命名（实测首字母大写+小写化规则，
// 同 Order customFieldsRiderlat 先例）；若 Task 1 Step 3 实测列名不同，此处同步修改。
// 挂载机制与 CreateCampusTablesMigration 一致：注册进 plugin providers，出错等待下次启动重试。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

export const backfillWaimaiIndustrySql = `
UPDATE channel
SET "customFieldsIndustrytype" = 'catering'
WHERE "customFieldsIndustrytype" IS NULL
  AND id IN (SELECT "channelId" FROM campus_fulfillment_config);
`;

@Injectable()
export class BackfillWaimaiIndustryMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const queryRunner = this.connection.createQueryRunner();
            try {
                await queryRunner.query(backfillWaimaiIndustrySql);
            } finally {
                await queryRunner.release();
            }
        } catch (e: any) {
            // 首次启动若 customFields 列尚未同步（先于 Vendure schema 同步执行时），只打日志等待下次启动重试
            // eslint-disable-next-line no-console
            console.error('[BackfillWaimaiIndustryMigration] failed:', e?.message);
        }
    }
}

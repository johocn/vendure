// 幂等建 campus 表：campus_zone / campus_building / rider_earning / campus_fulfillment_config /
// delivery_slot / rider_credit_log，并为 campus_fulfillment_config 补 plan3 新列。
// 生产 PostgreSQL 可能关闭 synchronize，故启动时补建；SQL 为 PG 专用，IF NOT EXISTS 幂等。
// 挂载机制与 coupon-plugin 一致：@Injectable + OnApplicationBootstrap，注册进 plugin providers，
// 出错只打日志不抛错、不阻塞启动，等待下次启动重试。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

export const createCampusTables = `
CREATE TABLE IF NOT EXISTS campus_zone (
  id SERIAL PRIMARY KEY, "createdAt" timestamptz DEFAULT now(), "updatedAt" timestamptz DEFAULT now(),
  name varchar(255) NOT NULL, fee int NOT NULL DEFAULT 0, "channelId" int NOT NULL);
CREATE TABLE IF NOT EXISTS campus_building (
  id SERIAL PRIMARY KEY, "createdAt" timestamptz DEFAULT now(), "updatedAt" timestamptz DEFAULT now(),
  name varchar(255) NOT NULL, detail varchar(255), "zoneId" int NOT NULL, "channelId" int NOT NULL);
CREATE TABLE IF NOT EXISTS rider_earning (
  id SERIAL PRIMARY KEY, "createdAt" timestamptz DEFAULT now(), "updatedAt" timestamptz DEFAULT now(),
  "orderId" int NOT NULL, "riderCustomerId" int NOT NULL,
  amount int NOT NULL, tip int NOT NULL DEFAULT 0, status varchar(255) DEFAULT 'credited', "channelId" int NOT NULL);
CREATE TABLE IF NOT EXISTS campus_fulfillment_config (
  id SERIAL PRIMARY KEY, "createdAt" timestamptz DEFAULT now(), "updatedAt" timestamptz DEFAULT now(),
  "channelId" int NOT NULL UNIQUE, "routesEnabled" jsonb, "riderCommissionRate" int DEFAULT 100,
  "autoAssignMinutes" int DEFAULT 10, paused boolean DEFAULT false);
CREATE TABLE IF NOT EXISTS delivery_slot (
  id SERIAL PRIMARY KEY, "createdAt" timestamptz DEFAULT now(), "updatedAt" timestamptz DEFAULT now(),
  "slotDate" date NOT NULL, "startTime" varchar(255) NOT NULL, "endTime" varchar(255) NOT NULL,
  "zoneId" int, capacity int NOT NULL DEFAULT 20, "lockedCount" int NOT NULL DEFAULT 0,
  active boolean DEFAULT true, "channelId" int NOT NULL);
CREATE TABLE IF NOT EXISTS rider_credit_log (
  id SERIAL PRIMARY KEY, "createdAt" timestamptz DEFAULT now(), "updatedAt" timestamptz DEFAULT now(),
  "customerId" int NOT NULL, delta int NOT NULL, reason varchar(255) NOT NULL,
  "orderId" int, "channelId" int NOT NULL);
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "autoRefundMinutes" int DEFAULT 30;
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "inProgressSlaMinutes" int DEFAULT 45;
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "compensationCouponTemplateId" varchar(255);
`;

@Injectable()
export class CreateCampusTablesMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const queryRunner = this.connection.createQueryRunner();
            try {
                const statements = createCampusTables
                    .split(';')
                    .map(s => s.trim())
                    .filter(s => s.length > 0);
                for (const statement of statements) {
                    await queryRunner.query(statement);
                }
            } finally {
                await queryRunner.release();
            }
        } catch (e: any) {
            // 建表失败不阻塞启动，等待下次启动重试
            // eslint-disable-next-line no-console
            console.error('[CreateCampusTablesMigration] failed to ensure tables:', e?.message);
        }
    }
}

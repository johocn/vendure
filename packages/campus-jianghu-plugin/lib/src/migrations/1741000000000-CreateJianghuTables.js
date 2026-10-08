"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateJianghuTables1741000000000 = void 0;
/**
 * 创建江湖域五张表（Postgres）。
 * 实体均继承 VendureEntity（含 uuid 主键 id + createdAt/updatedAt 时间戳），此处一并建出。
 * dev 环境若开启 synchronize 可自动建表；生产走本迁移。
 */
class CreateJianghuTables1741000000000 {
    async up(queryRunner) {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "jianghu_profile" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "customerId" integer NOT NULL,
                "nickname" character varying NOT NULL DEFAULT '江湖新丁',
                "rep" integer NOT NULL DEFAULT 0,
                "intel" integer NOT NULL DEFAULT 0,
                "rankCode" character varying NOT NULL DEFAULT 'L1',
                "credit" integer NOT NULL DEFAULT 100,
                "letterDone" integer NOT NULL DEFAULT 0,
                "intelDone" integer NOT NULL DEFAULT 0,
                "plotDone" integer NOT NULL DEFAULT 0,
                "urgentDone" integer NOT NULL DEFAULT 0,
                "secretDone" integer NOT NULL DEFAULT 0,
                "repToday" integer NOT NULL DEFAULT 0,
                "repDailyCap" integer NOT NULL DEFAULT 300,
                "repDay" character varying,
                "streakDays" integer NOT NULL DEFAULT 0,
                "lastActiveDay" character varying,
                "protectedUntil" character varying,
                "frozenUntil" character varying,
                "violateCount" integer NOT NULL DEFAULT 0,
                "campusCode" character varying,
                CONSTRAINT "PK_jianghu_profile" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_jianghu_profile_customer" ON "jianghu_profile" ("customerId")`);
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "jianghu_task" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "type" character varying NOT NULL,
                "level" character varying NOT NULL,
                "title" character varying NOT NULL,
                "brief" character varying,
                "plainText" text,
                "campusCode" character varying,
                "buildingCode" character varying,
                "targetCustomerId" integer,
                "targetNick" character varying,
                "targetBuilding" character varying,
                "rewardRep" integer NOT NULL DEFAULT 10,
                "rewardIntel" integer,
                "verifyMode" character varying NOT NULL,
                "boundOrderId" character varying,
                "status" character varying NOT NULL DEFAULT 'OPEN',
                "takenByCustomerId" integer,
                "takenAt" character varying,
                "expireAt" character varying,
                "verifyCode" character varying,
                "codeExpireAt" character varying,
                "tryCount" integer NOT NULL DEFAULT 0,
                "lat" double precision,
                "lng" double precision,
                "channelId" character varying,
                CONSTRAINT "PK_jianghu_task" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_jianghu_task_status" ON "jianghu_task" ("status")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_jianghu_task_type" ON "jianghu_task" ("type")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_jianghu_task_target" ON "jianghu_task" ("targetCustomerId")`);
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "jianghu_record" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "customerId" integer NOT NULL,
                "taskId" character varying,
                "idempotentKey" character varying NOT NULL,
                "reason" character varying NOT NULL,
                "reasonText" character varying,
                "deltaRep" integer NOT NULL DEFAULT 0,
                "deltaIntel" integer,
                "snapshotRep" integer,
                "channelId" character varying,
                CONSTRAINT "PK_jianghu_record" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_jianghu_record_customer" ON "jianghu_record" ("customerId")`);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_jianghu_record_idem" ON "jianghu_record" ("idempotentKey")`);
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "jianghu_intel" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "category" character varying NOT NULL,
                "campusCode" character varying,
                "summary" character varying NOT NULL,
                "content" text,
                "sourceNote" character varying NOT NULL,
                "priceIntel" integer NOT NULL DEFAULT 5,
                "viewCount" integer NOT NULL DEFAULT 0,
                "authorCustomerId" integer,
                "status" character varying NOT NULL DEFAULT 'PENDING',
                CONSTRAINT "PK_jianghu_intel" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_jianghu_intel_campus" ON "jianghu_intel" ("campusCode")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_jianghu_intel_status" ON "jianghu_intel" ("status")`);
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "jianghu_event" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "name" character varying NOT NULL,
                "desc" text NOT NULL,
                "total" integer NOT NULL DEFAULT 6,
                "collected" integer NOT NULL DEFAULT 0,
                "perPersonLimit" integer NOT NULL DEFAULT 2,
                "endAt" character varying,
                "rewardPoolRep" integer,
                CONSTRAINT "PK_jianghu_event" PRIMARY KEY ("id")
            )
        `);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE IF EXISTS "jianghu_event"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "jianghu_intel"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "jianghu_record"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "jianghu_task"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "jianghu_profile"`);
    }
}
exports.CreateJianghuTables1741000000000 = CreateJianghuTables1741000000000;
//# sourceMappingURL=1741000000000-CreateJianghuTables.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddJianghuClue1742000000000 = void 0;
/**
 * 新增江湖事件线索表（P2 多人拼图）。
 * dev 环境若开启 synchronize 可自动建表；生产走本迁移。
 */
class AddJianghuClue1742000000000 {
    async up(queryRunner) {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "jianghu_clue" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "eventId" character varying NOT NULL,
                "customerId" integer NOT NULL,
                "nickname" character varying,
                "content" text NOT NULL,
                "sourceNote" character varying NOT NULL,
                "campusCode" character varying,
                "likes" integer NOT NULL DEFAULT 0,
                "status" character varying NOT NULL DEFAULT 'SHOWN',
                CONSTRAINT "PK_jianghu_clue" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_jianghu_clue_event" ON "jianghu_clue" ("eventId")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_jianghu_clue_customer" ON "jianghu_clue" ("customerId")`);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE IF EXISTS "jianghu_clue"`);
    }
}
exports.AddJianghuClue1742000000000 = AddJianghuClue1742000000000;
//# sourceMappingURL=1742000000000-AddJianghuClue.js.map
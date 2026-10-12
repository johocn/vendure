// import type：生产由 node22 strip-types 直接加载 .ts（无 ts-node），值导入的具名类型在运行时不存在会导致 ESM 加载崩溃
import type {MigrationInterface, QueryRunner} from "typeorm";

/**
 * feedback-plugin 扩展（2026-10-12）：
 *  - faq_entry 多语言列 titleI18n/contentI18n（JSON 文本，zh-CN 为基线）
 *  - feedback 回复闭环列 reply/repliedAt/repliedBy + 用户已读标记 readAt
 * 全部 IF NOT EXISTS 幂等（新装环境建表后重跑迁移亦安全）。
 */
export class AddFeedbackFaqI18nReply1791937000000 implements MigrationInterface {

   public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "faq_entry" ADD COLUMN IF NOT EXISTS "titleI18n" text`, undefined);
        await queryRunner.query(`ALTER TABLE "faq_entry" ADD COLUMN IF NOT EXISTS "contentI18n" text`, undefined);
        await queryRunner.query(`ALTER TABLE "feedback" ADD COLUMN IF NOT EXISTS "reply" text`, undefined);
        await queryRunner.query(`ALTER TABLE "feedback" ADD COLUMN IF NOT EXISTS "repliedAt" TIMESTAMP`, undefined);
        await queryRunner.query(`ALTER TABLE "feedback" ADD COLUMN IF NOT EXISTS "repliedBy" character varying(255)`, undefined);
        await queryRunner.query(`ALTER TABLE "feedback" ADD COLUMN IF NOT EXISTS "readAt" TIMESTAMP`, undefined);
   }

   public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "feedback" DROP COLUMN IF EXISTS "readAt"`, undefined);
        await queryRunner.query(`ALTER TABLE "feedback" DROP COLUMN IF EXISTS "repliedBy"`, undefined);
        await queryRunner.query(`ALTER TABLE "feedback" DROP COLUMN IF EXISTS "repliedAt"`, undefined);
        await queryRunner.query(`ALTER TABLE "feedback" DROP COLUMN IF EXISTS "reply"`, undefined);
        await queryRunner.query(`ALTER TABLE "faq_entry" DROP COLUMN IF EXISTS "contentI18n"`, undefined);
        await queryRunner.query(`ALTER TABLE "faq_entry" DROP COLUMN IF EXISTS "titleI18n"`, undefined);
   }

}

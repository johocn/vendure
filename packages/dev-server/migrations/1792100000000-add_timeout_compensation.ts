// import type：生产由 node22 strip-types 直接加载 .ts（无 ts-node），值导入的具名类型在运行时不存在会导致 ESM 加载崩溃
import type {MigrationInterface, QueryRunner} from "typeorm";

/**
 * 超时赔付（P0）：
 * - order 表补承诺送达/补偿留痕自定义字段（IF NOT EXISTS：生产曾手工补过列，迁移可重复执行）
 * - campus_fulfillment_config 补开关/宽限/独立券模板列
 */
export class AddTimeoutCompensation1792100000000 implements MigrationInterface {

   public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "customFieldspromisedat" TIMESTAMP WITH TIME ZONE`, undefined);
        await queryRunner.query(`ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "customFieldspromisesource" varchar`, undefined);
        await queryRunner.query(`ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "customFieldstimeoutcompensatedat" TIMESTAMP WITH TIME ZONE`, undefined);
        await queryRunner.query(`ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "customFieldstimeoutcompensationcouponid" varchar`, undefined);
        await queryRunner.query(`ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "customFieldstimeoutlateminutes" integer`, undefined);
        await queryRunner.query(`ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "customFieldstimeoutattribution" varchar`, undefined);
        await queryRunner.query(`ALTER TABLE "campus_fulfillment_config" ADD COLUMN IF NOT EXISTS "timeoutCompensationEnabled" boolean NOT NULL DEFAULT false`, undefined);
        await queryRunner.query(`ALTER TABLE "campus_fulfillment_config" ADD COLUMN IF NOT EXISTS "timeoutGraceMinutes" integer NOT NULL DEFAULT 10`, undefined);
        await queryRunner.query(`ALTER TABLE "campus_fulfillment_config" ADD COLUMN IF NOT EXISTS "timeoutCompensationCouponTemplateId" varchar`, undefined);
   }

   public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "campus_fulfillment_config" DROP COLUMN IF EXISTS "timeoutCompensationCouponTemplateId"`, undefined);
        await queryRunner.query(`ALTER TABLE "campus_fulfillment_config" DROP COLUMN IF EXISTS "timeoutGraceMinutes"`, undefined);
        await queryRunner.query(`ALTER TABLE "campus_fulfillment_config" DROP COLUMN IF EXISTS "timeoutCompensationEnabled"`, undefined);
        await queryRunner.query(`ALTER TABLE "order" DROP COLUMN IF EXISTS "customFieldstimeoutattribution"`, undefined);
        await queryRunner.query(`ALTER TABLE "order" DROP COLUMN IF EXISTS "customFieldstimeoutlateminutes"`, undefined);
        await queryRunner.query(`ALTER TABLE "order" DROP COLUMN IF EXISTS "customFieldstimeoutcompensationcouponid"`, undefined);
        await queryRunner.query(`ALTER TABLE "order" DROP COLUMN IF EXISTS "customFieldstimeoutcompensatedat"`, undefined);
        await queryRunner.query(`ALTER TABLE "order" DROP COLUMN IF EXISTS "customFieldspromisesource"`, undefined);
        await queryRunner.query(`ALTER TABLE "order" DROP COLUMN IF EXISTS "customFieldspromisedat"`, undefined);
   }

}

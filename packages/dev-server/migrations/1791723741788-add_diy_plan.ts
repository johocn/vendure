// import type：生产由 node22 strip-types 直接加载 .ts（无 ts-node），值导入的具名类型在运行时不存在会导致 ESM 加载崩溃
import type {MigrationInterface, QueryRunner} from "typeorm";

export class AddDiyPlan1791723741788 implements MigrationInterface {

   public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TABLE "diy_plan" ("createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "app" character varying NOT NULL, "userId" integer, "templateId" integer NOT NULL, "templateVersion" integer NOT NULL DEFAULT '1', "status" character varying NOT NULL DEFAULT 'draft', "spec" text NOT NULL, "bom" text NOT NULL, "calcVersion" character varying(16) NOT NULL, "quoteNo" character varying(32), "expiresAt" TIMESTAMP, "orderLineId" integer, "thumb" character varying, "shareImage" character varying, "id" SERIAL NOT NULL, CONSTRAINT "PK_d80b2e65146e4b2bd1c05de3707" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE INDEX "idx_diy_plan_app_user" ON "diy_plan" ("app", "userId") `, undefined);
   }

   public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "public"."idx_diy_plan_app_user"`, undefined);
        await queryRunner.query(`DROP TABLE "diy_plan"`, undefined);
   }

}

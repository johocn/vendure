// import type：生产由 node22 strip-types 直接加载 .ts（无 ts-node），值导入的具名类型在运行时不存在会导致 ESM 加载崩溃
import type {MigrationInterface, QueryRunner} from "typeorm";

export class AddDiyEntities1791719991249 implements MigrationInterface {

   public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TABLE "diy_category" ("createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "app" character varying, "code" character varying, "parentId" integer, "name" text NOT NULL, "image" character varying, "sortOrder" integer NOT NULL DEFAULT '0', "enabled" boolean NOT NULL DEFAULT true, "id" SERIAL NOT NULL, CONSTRAINT "PK_662893b8a76b145b8e410f18eb1" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE TABLE "diy_material" ("createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "app" character varying, "code" character varying(64) NOT NULL, "name" text NOT NULL, "categoryId" integer NOT NULL, "shape" character varying NOT NULL, "diameter" double precision, "axialLength" double precision, "holeSize" double precision, "attrs" text, "render" text, "price" integer NOT NULL, "priceUnit" character varying NOT NULL DEFAULT 'piece', "currency" character varying(3) NOT NULL DEFAULT 'CNY', "stock" integer NOT NULL DEFAULT '0', "images" text, "sourceMaterialId" integer, "enabled" boolean NOT NULL DEFAULT true, "sortOrder" integer NOT NULL DEFAULT '0', "id" SERIAL NOT NULL, CONSTRAINT "PK_d28c7fb27b7d45c937b000a3159" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE INDEX "idx_diy_material_app_code" ON "diy_material" ("app", "code") `, undefined);
        await queryRunner.query(`CREATE TABLE "diy_template" ("createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "app" character varying, "code" character varying(64) NOT NULL, "name" text NOT NULL, "description" text, "thumb" character varying, "images" text, "config" text NOT NULL, "calculatorKey" character varying, "status" character varying NOT NULL DEFAULT 'draft', "version" integer NOT NULL DEFAULT '1', "sortOrder" integer NOT NULL DEFAULT '0', "id" SERIAL NOT NULL, CONSTRAINT "PK_d970be68270dc8e4ed2f60d3830" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE INDEX "idx_diy_template_app_code" ON "diy_template" ("app", "code") `, undefined);
   }

   public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "public"."idx_diy_template_app_code"`, undefined);
        await queryRunner.query(`DROP TABLE "diy_template"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."idx_diy_material_app_code"`, undefined);
        await queryRunner.query(`DROP TABLE "diy_material"`, undefined);
        await queryRunner.query(`DROP TABLE "diy_category"`, undefined);
   }

}

// import type：生产由 node22 strip-types 直接加载 .ts（无 ts-node），值导入的具名类型在运行时不存在会导致 ESM 加载崩溃
import type {MigrationInterface, QueryRunner} from "typeorm";

export class AddDiyOrderCustomFields1791724759208 implements MigrationInterface {

   public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "order_line" ADD "customFieldsDiyplanid" integer`, undefined);
        await queryRunner.query(`ALTER TABLE "order_line" ADD "customFieldsDiyunitprice" integer`, undefined);
        await queryRunner.query(`ALTER TABLE "order_line" ADD "customFieldsDiybom" text`, undefined);
        await queryRunner.query(`ALTER TABLE "order_line" ADD "customFieldsDiyquoterefamount" integer`, undefined);
   }

   public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "order_line" DROP COLUMN "customFieldsDiyquoterefamount"`, undefined);
        await queryRunner.query(`ALTER TABLE "order_line" DROP COLUMN "customFieldsDiybom"`, undefined);
        await queryRunner.query(`ALTER TABLE "order_line" DROP COLUMN "customFieldsDiyunitprice"`, undefined);
        await queryRunner.query(`ALTER TABLE "order_line" DROP COLUMN "customFieldsDiyplanid"`, undefined);
   }

}

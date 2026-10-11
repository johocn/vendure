import {MigrationInterface, QueryRunner} from "typeorm";

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

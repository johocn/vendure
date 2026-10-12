// import type：生产由 node22 strip-types 直接加载 .ts（无 ts-node），值导入的具名类型在运行时不存在会导致 ESM 加载崩溃
import type {MigrationInterface, QueryRunner} from "typeorm";

/**
 * OrderLine 新增 copiedFrom（v2 公开方案直购）：下单他人 isPublic 方案时记录原作者 userId，自购为 NULL。
 * 列名规则 = camelCase('customFields') + titleCase(name)（typeorm DefaultNamingStrategy），
 * 'copiedFrom' → 'customFieldsCopiedfrom'，与 1791724759208 迁移的既有列同款。
 * pg 走 ADD COLUMN IF NOT EXISTS 幂等；其余方言按 getTable 列存在性检查后再 ADD。
 */
export class AddOrderLineCopiedFrom1791960000000 implements MigrationInterface {

   private dialectOf(queryRunner: QueryRunner): string {
        return String((queryRunner.connection.options as any).type ?? '');
   }

   private async hasColumn(queryRunner: QueryRunner, table: string, column: string): Promise<boolean> {
        const t = await queryRunner.getTable(table);
        return !!t && !!t.findColumnByName(column);
   }

   public async up(queryRunner: QueryRunner): Promise<any> {
        if (this.dialectOf(queryRunner) === 'postgres') {
            await queryRunner.query(`ALTER TABLE "order_line" ADD COLUMN IF NOT EXISTS "customFieldsCopiedfrom" integer`, undefined);
            return;
        }
        if (!(await this.hasColumn(queryRunner, 'order_line', 'customFieldsCopiedfrom'))) {
            await queryRunner.query(`ALTER TABLE "order_line" ADD "customFieldsCopiedfrom" integer`, undefined);
        }
   }

   public async down(queryRunner: QueryRunner): Promise<any> {
        if (this.dialectOf(queryRunner) === 'postgres') {
            await queryRunner.query(`ALTER TABLE "order_line" DROP COLUMN IF EXISTS "customFieldsCopiedfrom"`, undefined);
            return;
        }
        if (await this.hasColumn(queryRunner, 'order_line', 'customFieldsCopiedfrom')) {
            await queryRunner.query(`ALTER TABLE "order_line" DROP COLUMN "customFieldsCopiedfrom"`, undefined);
        }
   }

}

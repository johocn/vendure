// import type：生产由 node22 strip-types 直接加载 .ts（无 ts-node），值导入的具名类型在运行时不存在会导致 ESM 加载崩溃
import type {MigrationInterface, QueryRunner} from "typeorm";

/**
 * diy v2（2026-10-12）：
 *  - diy_material 渲染列 renderUrl/renderPreset（varchar 可空）
 *  - diy_plan 分享列 isPublic（boolean NOT NULL DEFAULT false）/ publishedAt（可空时间戳）
 * pg 走 ADD COLUMN IF NOT EXISTS 幂等；其余方言按 queryRunner.getTable 列存在性检查后
 * 再 ADD（等价 PRAGMA table_info 惯例且跨方言可用；sqlite 布尔 DEFAULT 0、时间戳 datetime）。
 */
export class AddDiyRenderPublic1791950000000 implements MigrationInterface {

   private dialectOf(queryRunner: QueryRunner): string {
        return String((queryRunner.connection.options as any).type ?? '');
   }

   private async hasColumn(queryRunner: QueryRunner, table: string, column: string): Promise<boolean> {
        const t = await queryRunner.getTable(table);
        return !!t && !!t.findColumnByName(column);
   }

   public async up(queryRunner: QueryRunner): Promise<any> {
        if (this.dialectOf(queryRunner) === 'postgres') {
            await queryRunner.query(`ALTER TABLE "diy_material" ADD COLUMN IF NOT EXISTS "renderUrl" character varying`, undefined);
            await queryRunner.query(`ALTER TABLE "diy_material" ADD COLUMN IF NOT EXISTS "renderPreset" character varying`, undefined);
            await queryRunner.query(`ALTER TABLE "diy_plan" ADD COLUMN IF NOT EXISTS "isPublic" boolean NOT NULL DEFAULT false`, undefined);
            await queryRunner.query(`ALTER TABLE "diy_plan" ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP`, undefined);
            return;
        }
        if (!(await this.hasColumn(queryRunner, 'diy_material', 'renderUrl'))) {
            await queryRunner.query(`ALTER TABLE "diy_material" ADD "renderUrl" character varying`, undefined);
        }
        if (!(await this.hasColumn(queryRunner, 'diy_material', 'renderPreset'))) {
            await queryRunner.query(`ALTER TABLE "diy_material" ADD "renderPreset" character varying`, undefined);
        }
        if (!(await this.hasColumn(queryRunner, 'diy_plan', 'isPublic'))) {
            await queryRunner.query(`ALTER TABLE "diy_plan" ADD "isPublic" boolean NOT NULL DEFAULT 0`, undefined);
        }
        if (!(await this.hasColumn(queryRunner, 'diy_plan', 'publishedAt'))) {
            await queryRunner.query(`ALTER TABLE "diy_plan" ADD "publishedAt" datetime`, undefined);
        }
   }

   public async down(queryRunner: QueryRunner): Promise<any> {
        if (this.dialectOf(queryRunner) === 'postgres') {
            await queryRunner.query(`ALTER TABLE "diy_plan" DROP COLUMN IF EXISTS "publishedAt"`, undefined);
            await queryRunner.query(`ALTER TABLE "diy_plan" DROP COLUMN IF EXISTS "isPublic"`, undefined);
            await queryRunner.query(`ALTER TABLE "diy_material" DROP COLUMN IF EXISTS "renderPreset"`, undefined);
            await queryRunner.query(`ALTER TABLE "diy_material" DROP COLUMN IF EXISTS "renderUrl"`, undefined);
            return;
        }
        const drops: Array<[string, string]> = [
            ['diy_plan', 'publishedAt'],
            ['diy_plan', 'isPublic'],
            ['diy_material', 'renderPreset'],
            ['diy_material', 'renderUrl'],
        ];
        for (const [table, column] of drops) {
            if (await this.hasColumn(queryRunner, table, column)) {
                await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN "${column}"`, undefined);
            }
        }
   }

}

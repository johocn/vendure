import { QueryRunner } from 'typeorm';
/**
 * @description
 * Populates the new join tables for shared, channel-aware ProductOptionGroups
 * using data from the existing `productId` FK column on `product_option_group`.
 *
 * Call this from your migration's `up()` method **after** the new join tables
 * have been created and **before** the `productId` column is dropped.
 *
 * ```ts
 * import { MigrationInterface, QueryRunner } from 'typeorm';
 * import { migrateProductOptionGroupData } from '\@vendure/core';
 *
 * export class SharedOptionGroups1234567890 implements MigrationInterface {
 *     public async up(queryRunner: QueryRunner): Promise<any> {
 *         // --- Auto-generated DDL starts here ---
 *         // (Create new join tables and FK constraints)
 *         // ...
 *
 *         // --- Populate new tables with existing data ---
 *         await migrateProductOptionGroupData(queryRunner);
 *
 *         // --- Auto-generated DDL continues ---
 *         // (Drop old productId FK and column)
 *         // ...
 *     }
 *
 *     public async down(queryRunner: QueryRunner): Promise<any> {
 *         // Auto-generated reverse DDL
 *     }
 * }
 * ```
 *
 * @since 3.6.0
 * @docsCategory migration
 */
export declare function migrateProductOptionGroupData(queryRunner: QueryRunner): Promise<void>;

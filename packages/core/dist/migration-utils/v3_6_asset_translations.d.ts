import { QueryRunner } from 'typeorm';
/**
 * @description
 * Populates the new `asset_translation` table with data from the existing `name`
 * column on `asset`, using the default channel's language code.
 *
 * Call this from your migration's `up()` method **after** the `asset_translation`
 * table has been created and **before** the `name` column is dropped from `asset`.
 *
 * ```ts
 * import { MigrationInterface, QueryRunner } from 'typeorm';
 * import { migrateAssetTranslationData } from '\@vendure/core';
 *
 * export class V36Migration1234567890 implements MigrationInterface {
 *     public async up(queryRunner: QueryRunner): Promise<any> {
 *         // --- Auto-generated DDL starts here ---
 *         // (Create asset_translation table)
 *         // ...
 *
 *         // --- Populate new table with existing data ---
 *         await migrateAssetTranslationData(queryRunner);
 *
 *         // --- Auto-generated DDL continues ---
 *         // (Drop name column from asset)
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
export declare function migrateAssetTranslationData(queryRunner: QueryRunner): Promise<void>;

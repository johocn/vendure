import { MigrationInterface, QueryRunner } from 'typeorm';
/**
 * 创建江湖域五张表（Postgres）。
 * 实体均继承 VendureEntity（含 uuid 主键 id + createdAt/updatedAt 时间戳），此处一并建出。
 * dev 环境若开启 synchronize 可自动建表；生产走本迁移。
 */
export declare class CreateJianghuTables1741000000000 implements MigrationInterface {
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}

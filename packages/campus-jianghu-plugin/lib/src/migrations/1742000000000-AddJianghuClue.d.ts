import { MigrationInterface, QueryRunner } from 'typeorm';
/**
 * 新增江湖事件线索表（P2 多人拼图）。
 * dev 环境若开启 synchronize 可自动建表；生产走本迁移。
 */
export declare class AddJianghuClue1742000000000 implements MigrationInterface {
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}

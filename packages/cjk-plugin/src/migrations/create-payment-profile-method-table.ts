// 幂等补建 payment_profile_method 表（支付档案 × 支付方式的模式载荷表）。
// 背景：PaymentProfileMethod 实体此前未注册进 plugin entities，TypeORM 无 metadata，
// checkoutSplitted 对关联支付档案的商品下单时 attachMethodConfigs 报
// "No metadata for PaymentProfileMethod was found"（2026-10-12 线上）。
// 本 migration 与实体注册配合：注册提供 metadata，此处保证表真实存在。
// 列与 payment-profile-method.entity.ts 完全对齐；幂等由 IF NOT EXISTS 保证，失败不阻塞启动。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

function isPostgres(driver: string): boolean {
    return driver === 'postgres' || driver === 'postgresql';
}

@Injectable()
export class PaymentProfileMethodTableMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        const queryRunner = this.connection.createQueryRunner();
        try {
            const driver = (this.connection.options as any).type as string;
            const pg = isPostgres(driver);
            const pk = pg ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
            const datetime = pg ? 'timestamptz' : 'datetime';
            const Q = (s: string) => `"${s}"`;

            await queryRunner.query(
                `CREATE TABLE IF NOT EXISTS ${Q('payment_profile_method')} (` +
                    `${Q('id')} ${pk}, ` +
                    `${Q('createdAt')} ${datetime} NOT NULL, ` +
                    `${Q('updatedAt')} ${datetime} NOT NULL, ` +
                    `${Q('profileId')} varchar(255) NOT NULL, ` +
                    `${Q('paymentMethodId')} varchar(255) NOT NULL, ` +
                    `${Q('mode')} varchar(255) NOT NULL DEFAULT 'installment', ` +
                    `${Q('options')} text NULL)`,
            );
            // 查询路径均以 profileId 为入口（findOne: profileId+paymentMethodId / attachMethodConfigs: profileId）
            await queryRunner.query(
                `CREATE INDEX IF NOT EXISTS ${'idx_payment_profile_method_profileId'} ` +
                    `ON ${Q('payment_profile_method')} (${Q('profileId')})`,
            );
        } catch (e: any) {
            // 建表失败不阻塞启动，等待下次启动重试
            // eslint-disable-next-line no-console
            console.error('[PaymentProfileMethodTableMigration] failed to ensure table:', e?.message);
        } finally {
            await queryRunner.release();
        }
    }
}

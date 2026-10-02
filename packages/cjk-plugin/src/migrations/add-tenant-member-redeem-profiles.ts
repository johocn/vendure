// 确保 tenant_member 表存在 shipping_profile_ids 列（可核销配送档案白名单）
// 生产（PostgreSQL）与本地开发（SQLite）都可能关闭 synchronize，故此 migration 幂等地补列。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection, TableColumn } from 'typeorm';

@Injectable()
export class AddTenantMemberRedeemProfiles implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const metadata = this.connection.getMetadata('TenantMember');
            const tableName = metadata.tableName;
            const queryRunner = this.connection.createQueryRunner();
            try {
                if (!(await queryRunner.hasColumn(tableName, 'shipping_profile_ids'))) {
                    await queryRunner.addColumn(
                        tableName,
                        new TableColumn({
                            name: 'shipping_profile_ids',
                            type: 'text',
                            isNullable: false,
                            // 字符串默认值按原样包裹单引号：pg/sqlite 均产出 DEFAULT '[]'
                            default: '[]',
                        }),
                    );
                }
            } finally {
                await queryRunner.release();
            }
        } catch (e: any) {
            // 补列失败不阻塞启动，等待下次启动重试
            // eslint-disable-next-line no-console
            console.error('[AddTenantMemberRedeemProfiles] failed to ensure column:', e?.message);
        }
    }
}

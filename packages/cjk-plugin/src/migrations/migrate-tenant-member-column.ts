// 确保 tenant_member 表存在 mustChangePassword 列（首登强改密）
// 生产（PostgreSQL）与本地开发（SQLite）都可能关闭 synchronize，故此 migration 幂等地补列。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection, TableColumn } from 'typeorm';

@Injectable()
export class TenantMemberColumnMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const metadata = this.connection.getMetadata('TenantMember');
            const tableName = metadata.tableName;
            const queryRunner = this.connection.createQueryRunner();
            try {
                if (!(await queryRunner.hasColumn(tableName, 'must_change_password'))) {
                    // 布尔列默认 false：既有人员无需强改密，仅新建未传密码人员置 true
                    await queryRunner.addColumn(
                        tableName,
                        new TableColumn({
                            name: 'must_change_password',
                            type: 'boolean',
                            isNullable: false,
                            default: false,
                        }),
                    );
                }
            } finally {
                await queryRunner.release();
            }
        } catch (e: any) {
            // 补列失败不阻塞启动，等待下次启动重试；不影响已存在列的场景
            // eslint-disable-next-line no-console
            console.error('[TenantMemberColumnMigration] failed to ensure mustChangePassword column:', e?.message);
        }
    }
}
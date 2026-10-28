// 幂等补齐自提点后台 CRUD 权限：
// 之前 pickup admin resolver 未声明 @Allow，任意已登录管理端用户都能读写自提点。
// 现改为需要 PickupLocationRead/Create/Update/Delete，为避免既有租户管理员/销售/收银
// 突然 403，这里给「已持有订单读写权限」的角色自动补授这四项权限。
// 幂等：仅追加缺失项，重复启动不会重复写入。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

const GRANTED_PERMISSIONS = [
    'PickupLocationRead',
    'PickupLocationCreate',
    'PickupLocationUpdate',
    'PickupLocationDelete',
];

/** 触发补授的既有权限：具备订单读写能力的角色才需要维护自提点 */
const TRIGGER_PERMISSIONS = ['ReadOrder', 'UpdateOrder'];

@Injectable()
export class PickupPermissionsRoleGrantMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        const queryRunner = this.connection.createQueryRunner();
        try {
            if (!(await queryRunner.hasTable('role'))) {
                return;
            }
            const Q = (name: string) => this.connection.driver.escape(name);
            const driver = (this.connection.options as any).type as string;
            const isPostgres = driver === 'postgres' || driver === 'postgresql';
            const p1 = isPostgres ? '$1' : '?';
            const p2 = isPostgres ? '$2' : '?';

            const rows: Array<{ id: any; permissions: string | null }> = await queryRunner.query(
                `SELECT ${Q('id')} AS id, ${Q('permissions')} AS permissions FROM ${Q('role')}`,
            );
            for (const row of rows) {
                const current = String(row.permissions ?? '')
                    .split(',')
                    .map(p => p.trim())
                    .filter(Boolean);
                if (!current.some(p => TRIGGER_PERMISSIONS.includes(p))) {
                    continue;
                }
                const missing = GRANTED_PERMISSIONS.filter(p => !current.includes(p));
                if (missing.length === 0) {
                    continue;
                }
                await queryRunner.query(
                    `UPDATE ${Q('role')} SET ${Q('permissions')} = ${p1} WHERE ${Q('id')} = ${p2}`,
                    [[...current, ...missing].join(','), row.id],
                );
                // eslint-disable-next-line no-console
                console.log(
                    `[PickupPermissionsRoleGrantMigration] granted ${missing.join(',')} to role ${row.id}`,
                );
            }
        } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error('[PickupPermissionsRoleGrantMigration] failed:', e?.message);
        } finally {
            await queryRunner.release();
        }
    }
}

// 幂等补 wechat_shopping_session.state/draft 两列（聊天内补录状态机：手机号 → 收货地址）。
// 仿 cjk-plugin 迁移模式：OnApplicationBootstrap + hasColumn 检查，失败不阻塞启动。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection, TableColumn } from 'typeorm';

@Injectable()
export class ShoppingSessionFlowColumnsMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        const runner = this.connection.createQueryRunner();
        try {
            const tableName = this.connection.getMetadata('WechatShoppingSession').tableName;
            if (!(await runner.hasColumn(tableName, 'state'))) {
                await runner.addColumn(
                    tableName,
                    new TableColumn({ name: 'state', type: 'varchar', length: '32', isNullable: true }),
                );
                // eslint-disable-next-line no-console
                console.log(`[ShoppingSessionFlowColumnsMigration] added ${tableName}.state`);
            }
            if (!(await runner.hasColumn(tableName, 'draft'))) {
                // simple-json 实体列在方言底层为 text/json；手动建列用 text，typeorm 读写自行 JSON 序列化
                await runner.addColumn(
                    tableName,
                    new TableColumn({ name: 'draft', type: 'text', isNullable: true }),
                );
                // eslint-disable-next-line no-console
                console.log(`[ShoppingSessionFlowColumnsMigration] added ${tableName}.draft`);
            }
        } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error('[ShoppingSessionFlowColumnsMigration] failed to ensure columns:', e?.message);
        } finally {
            await runner.release();
        }
    }
}

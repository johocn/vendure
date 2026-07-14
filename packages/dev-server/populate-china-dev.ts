/* eslint-disable no-console */
import { bootstrap, JobQueueService, Logger } from '@vendure/core';
import { clearAllTables } from '@vendure/testing';
import { DataSource } from 'typeorm';

import { devConfig } from './dev-config';
import {
    populateBase,
    populateDefaultChannel,
    populateShopAChannel,
    populatePromotions,
    populateCustomers,
    populateOrders,
    runStage,
    logStage,
    StageResult,
} from './china-data';

// clearAllTables 不清插件表，需在 clearAllTables 之前清空 customer_balance，
// 否则 clearAllTables/bootstrap 的 schema sync 添加 FK 约束时会因脏数据失败
async function clearPluginTables(): Promise<void> {
    const opts = devConfig.dbConnectionOptions as any;
    const dataSource = new DataSource({
        type: opts.type,
        host: opts.host,
        port: opts.port,
        username: opts.username,
        password: opts.password,
        database: opts.database,
        schema: opts.schema,
        synchronize: false,
        entities: [],
        migrations: [],
    });
    await dataSource.initialize();
    try {
        await dataSource.query('DELETE FROM customer_balance');
        console.log('已清空 customer_balance 表');
    } catch (e: any) {
        if (!/does not exist|不存在|no such table/i.test(e.message)) {
            console.warn(`清空 customer_balance 表时警告: ${e.message}`);
        }
    }
    await dataSource.destroy();
}

if (require.main === module) {
    clearPluginTables()
        .then(() => clearAllTables(devConfig, true))
        .then(() => bootstrap(devConfig))
        .then(async app => {
            await app.get(JobQueueService).start();
            const results: StageResult[] = [];
            const total = 6;

            results.push(await runStage('基础设置: superadmin + Zone/Country/TaxRate/Facet/Collection', () => populateBase(app)));
            logStage(1, total, results[0]);

            results.push(await runStage('default Channel: 8 SPU + 4 配送 + 3 支付 + 3 自提点', () => populateDefaultChannel(app)));
            logStage(2, total, results[1]);

            results.push(await runStage('shop-a Channel: 创建 + 8 商品分配 + 2 配送 + 3 支付 + 1 自提点', () => populateShopAChannel(app)));
            logStage(3, total, results[2]);

            results.push(await runStage('优惠券: default 1 + shop-a 2', () => populatePromotions(app)));
            logStage(4, total, results[3]);

            results.push(await runStage('客户: 3 + 余额账户 2', () => populateCustomers(app)));
            logStage(5, total, results[4]);

            results.push(await runStage('历史订单: default 5 + shop-a 3', () => populateOrders(app)));
            logStage(6, total, results[5]);

            const okCount = results.filter(r => r.ok).length;
            const totalMs = results.reduce((sum, r) => sum + r.durationMs, 0);
            console.log(`\n完成! ${okCount}/${total} 阶段成功, 总耗时: ${(totalMs / 1000).toFixed(1)}s`);
            if (okCount < total) {
                console.log('失败阶段:');
                results.filter(r => !r.ok).forEach(r => console.log(`  - ${r.name}: ${r.error}`));
            }

            return app.close();
        })
        .then(() => process.exit(0))
        .catch(err => {
            console.error(err);
            process.exit(1);
        });
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable no-console */
const core_1 = require("@vendure/core");
const testing_1 = require("@vendure/testing");
const typeorm_1 = require("typeorm");
const dev_config_1 = require("./dev-config");
const china_data_1 = require("./china-data");
// clearAllTables 不清插件表，需在 clearAllTables 之前清空 customer_balance，
// 否则 clearAllTables/bootstrap 的 schema sync 添加 FK 约束时会因脏数据失败
async function clearPluginTables() {
    const opts = dev_config_1.devConfig.dbConnectionOptions;
    const dataSource = new typeorm_1.DataSource({
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
    }
    catch (e) {
        if (!/does not exist|不存在|no such table/i.test(e.message)) {
            console.warn(`清空 customer_balance 表时警告: ${e.message}`);
        }
    }
    // 清空 shipping_template 关联表（避免 FK 约束阻止 clearAllTables 清理 channel 表）
    try {
        await dataSource.query('DELETE FROM shipping_template_channels');
    }
    catch (e) {
        if (!/does not exist|不存在|no such table/i.test(e.message)) {
            console.warn(`清空 shipping_template_channels 表时警告: ${e.message}`);
        }
    }
    try {
        await dataSource.query('DELETE FROM shipping_template');
        console.log('已清空 shipping_template 表');
    }
    catch (e) {
        if (!/does not exist|不存在|no such table/i.test(e.message)) {
            console.warn(`清空 shipping_template 表时警告: ${e.message}`);
        }
    }
    // 清空 coupon 相关表（避免 FK 约束阻止 clearAllTables 清理 channel 表）
    try {
        await dataSource.query('DELETE FROM coupon_code_channels');
    }
    catch (e) {
        if (!/does not exist|不存在|no such table/i.test(e.message)) {
            console.warn(`清空 coupon_code_channels 表时警告: ${e.message}`);
        }
    }
    try {
        await dataSource.query('DELETE FROM coupon_channels');
    }
    catch (e) {
        if (!/does not exist|不存在|no such table/i.test(e.message)) {
            console.warn(`清空 coupon_channels 表时警告: ${e.message}`);
        }
    }
    try {
        await dataSource.query('DELETE FROM coupon_code');
        console.log('已清空 coupon_code 表');
    }
    catch (e) {
        if (!/does not exist|不存在|no such table/i.test(e.message)) {
            console.warn(`清空 coupon_code 表时警告: ${e.message}`);
        }
    }
    try {
        await dataSource.query('DELETE FROM coupon');
        console.log('已清空 coupon 表');
    }
    catch (e) {
        if (!/does not exist|不存在|no such table/i.test(e.message)) {
            console.warn(`清空 coupon 表时警告: ${e.message}`);
        }
    }
    await dataSource.destroy();
}
if (require.main === module) {
    clearPluginTables()
        .then(() => (0, testing_1.clearAllTables)(dev_config_1.devConfig, true))
        .then(() => (0, core_1.bootstrap)(dev_config_1.devConfig))
        .then(async (app) => {
        await app.get(core_1.JobQueueService).start();
        const results = [];
        const total = 11;
        results.push(await (0, china_data_1.runStage)('基础设置: superadmin + Zone/Country/TaxRate/Facet/Collection', () => (0, china_data_1.populateBase)(app)));
        (0, china_data_1.logStage)(1, total, results[0]);
        results.push(await (0, china_data_1.runStage)('default Channel: 8 SPU + 4 配送 + 3 支付 + 3 自提点', () => (0, china_data_1.populateDefaultChannel)(app)));
        (0, china_data_1.logStage)(2, total, results[1]);
        results.push(await (0, china_data_1.runStage)('shop-a Channel: 创建 + 8 商品分配 + 2 配送 + 3 支付 + 1 自提点', () => (0, china_data_1.populateShopAChannel)(app)));
        (0, china_data_1.logStage)(3, total, results[2]);
        results.push(await (0, china_data_1.runStage)('优惠券: default 1 + shop-a 2', () => (0, china_data_1.populatePromotions)(app)));
        (0, china_data_1.logStage)(4, total, results[3]);
        results.push(await (0, china_data_1.runStage)('客户: 3 + 余额账户 2', () => (0, china_data_1.populateCustomers)(app)));
        (0, china_data_1.logStage)(5, total, results[4]);
        results.push(await (0, china_data_1.runStage)('历史订单: default 5 + shop-a 3', () => (0, china_data_1.populateOrders)(app)));
        (0, china_data_1.logStage)(6, total, results[5]);
        results.push(await (0, china_data_1.runStage)('楼层配置: default 2 + shop-a 1', () => (0, china_data_1.populateFloors)(app)));
        (0, china_data_1.logStage)(7, total, results[6]);
        results.push(await (0, china_data_1.runStage)('全局配送模板: 11 个', () => (0, china_data_1.populateShippingTemplates)(app)));
        (0, china_data_1.logStage)(8, total, results[7]);
        results.push(await (0, china_data_1.runStage)('全局优惠券: 10 个', () => (0, china_data_1.populateCoupons)(app)));
        (0, china_data_1.logStage)(9, total, results[8]);
        results.push(await (0, china_data_1.runStage)('会员档位权益: 5 档 (金卡专属折扣率 50/白金100/钻石150)', () => (0, china_data_1.populateMemberTiers)(app)));
        (0, china_data_1.logStage)(10, total, results[9]);
        results.push(await (0, china_data_1.runStage)('拆单测试: shop-b 渠道 + 两租户配送/支付档案 + 变体绑定', () => (0, china_data_1.populateShippingSplit)(app)));
        (0, china_data_1.logStage)(11, total, results[10]);
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
//# sourceMappingURL=populate-china-dev.js.map
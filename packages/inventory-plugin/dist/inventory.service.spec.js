"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// @vitest
// 说明：本文件为 locationServesCity 的单元测试。
// 当前 inventory-plugin 的 vitest 配置 (vitest.config.mts) 仅匹配 `**/*.e2e-spec.ts`，
// 且 package.json 无独立 `test` 脚本，故此 spec 未接入自动执行通道；
// 用作类型验证 + 手工对照参考。运行方式：
//   node_modules/.bin/vitest run packages/inventory-plugin/src/inventory.service.spec.ts --config packages/inventory-plugin/vitest.config.mts --include '**/*.spec.ts'
const vitest_1 = require("vitest");
const inventory_service_1 = require("./inventory.service");
(0, vitest_1.describe)('InventoryService.locationServesCity', () => {
    // locationServesCity 是 private，通过原型链以空实例调用（方法内不使用依赖）
    function call(loc, city) {
        return inventory_service_1.InventoryService.prototype.locationServesCity.call({ /* no deps used */}, loc, city);
    }
    const loc = (serviceCities) => ({ customFields: { serviceCities } });
    (0, vitest_1.it)('精确匹配', () => {
        (0, vitest_1.expect)(call(loc(['杭州', '上海']), '杭州')).toBe(true);
    });
    (0, vitest_1.it)('前缀匹配（客户城市=市+省后缀）', () => {
        (0, vitest_1.expect)(call(loc(['杭州']), '杭州市')).toBe(true);
        (0, vitest_1.expect)(call(loc(['杭州市']), '杭州')).toBe(true);
    });
    (0, vitest_1.it)('大小写归一', () => {
        (0, vitest_1.expect)(call(loc(['Hangzhou']), 'hangzhou')).toBe(true);
    });
    (0, vitest_1.it)('无 serviceCities 返回 true（全仓可服务）', () => {
        (0, vitest_1.expect)(call(loc([]), '杭州')).toBe(true);
        (0, vitest_1.expect)(call({ customFields: {} }, '杭州')).toBe(true);
    });
    (0, vitest_1.it)('不匹配返回 false', () => {
        (0, vitest_1.expect)(call(loc(['上海']), '杭州')).toBe(false);
    });
});

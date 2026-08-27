// @vitest
// 说明：本文件为 locationServesCity 的单元测试。
// 当前 inventory-plugin 的 vitest 配置 (vitest.config.mts) 仅匹配 `**/*.e2e-spec.ts`，
// 且 package.json 无独立 `test` 脚本，故此 spec 未接入自动执行通道；
// 用作类型验证 + 手工对照参考。运行方式：
//   node_modules/.bin/vitest run packages/inventory-plugin/src/inventory.service.spec.ts --config packages/inventory-plugin/vitest.config.mts --include '**/*.spec.ts'
import { describe, expect, it } from 'vitest';
import { InventoryService } from './inventory.service';

describe('InventoryService.locationServesCity', () => {
    // locationServesCity 是 private，通过原型链以空实例调用（方法内不使用依赖）
    function call(loc: any, city: string): boolean {
        return (InventoryService.prototype as any).locationServesCity.call(
            { /* no deps used */ },
            loc,
            city,
        );
    }

    const loc = (serviceCities: string[]) =>
        ({ customFields: { serviceCities } }) as any;

    it('精确匹配', () => {
        expect(call(loc(['杭州', '上海']), '杭州')).toBe(true);
    });

    it('前缀匹配（客户城市=市+省后缀）', () => {
        expect(call(loc(['杭州']), '杭州市')).toBe(true);
        expect(call(loc(['杭州市']), '杭州')).toBe(true);
    });

    it('大小写归一', () => {
        expect(call(loc(['Hangzhou']), 'hangzhou')).toBe(true);
    });

    it('无 serviceCities 返回 true（全仓可服务）', () => {
        expect(call(loc([]), '杭州')).toBe(true);
        expect(call({ customFields: {} }, '杭州')).toBe(true);
    });

    it('不匹配返回 false', () => {
        expect(call(loc(['上海']), '杭州')).toBe(false);
    });
});
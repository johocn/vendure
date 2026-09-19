import { Injectable } from '@nestjs/common';
import { RequestContext } from '@vendure/core';

export type InventoryMode = 'simple' | 'odoo';

/**
 * 库存管理模式开关：
 * - currentMode：读渠道自定义字段 inventoryMode（兜底 'simple'）
 * - assertSimple：odoo 模式下抛只读错误，用于单据落库门控
 */
@Injectable()
export class InventoryModeService {
    currentMode(ctx: RequestContext): InventoryMode {
        const mode = String((ctx.channel as any)?.customFields?.inventoryMode ?? 'simple');
        return mode === 'odoo' ? 'odoo' : 'simple';
    }

    assertSimple(ctx: RequestContext): void {
        if (this.currentMode(ctx) === 'odoo') {
            throw new Error('Odoo 库存模式为只读，禁止直接落库单据');
        }
    }
}
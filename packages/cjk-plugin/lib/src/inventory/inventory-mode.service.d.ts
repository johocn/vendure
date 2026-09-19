import { RequestContext } from '@vendure/core';
import { InventoryAdapter } from './inventory-adapter';
import { SimpleInventoryAdapter } from './simple-inventory.adapter';
import { OdooInventoryAdapter } from './odoo-inventory.adapter';
export type InventoryMode = 'simple' | 'odoo';
/**
 * 库存管理模式开关：
 * - currentMode：读渠道自定义字段 inventoryMode（兜底 'simple'）
 * - assertSimple：odoo 模式下抛只读错误，用于单据落库门控
 * - getAdapter：按 currentMode 返回对应库存适配器（simple=本地 / odoo=预留 stub）
 */
export declare class InventoryModeService {
    private simpleInventoryAdapter;
    private odooInventoryAdapter;
    constructor(simpleInventoryAdapter: SimpleInventoryAdapter, odooInventoryAdapter: OdooInventoryAdapter);
    currentMode(ctx: RequestContext): InventoryMode;
    assertSimple(ctx: RequestContext): void;
    getAdapter(ctx: RequestContext): InventoryAdapter;
}

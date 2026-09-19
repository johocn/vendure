import { Injectable } from '@nestjs/common';
import { RequestContext } from '@vendure/core';
import { InventoryAdapter, InventoryAdapterMode, StockSnapshot } from './inventory-adapter';

/**
 * Odoo 适配器（预留 stub，不实现真实 HTTP 调用）。
 * 后续对接 Odoo xmlrpc/jsonrpc：fetchStock 查询 Odoo 库存，fetchCost 查询 Odoo 成本。
 * 当前返回示例数据，便于前端联调 shape。
 */
@Injectable()
export class OdooInventoryAdapter implements InventoryAdapter {
    mode: InventoryAdapterMode = 'odoo';

    async fetchStock(_ctx: RequestContext, variantId: number, _locationId?: number): Promise<StockSnapshot[]> {
        return [{ variantId, locationId: 0, onHand: 0, costPrice: null }];
    }

    async fetchCost(_ctx: RequestContext, _variantId: number, _locationId?: number): Promise<number | null> {
        return null;
    }
}
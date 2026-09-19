import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext } from '@vendure/core';
import { InventoryPermissions } from '@vendure/inventory-plugin';
import { StockDocService, StockDocCreateInput } from './stock-doc.service';

/** 管理端：库存单据（采购/移库/盘库/出库） + 库存流水查询 */
@Resolver()
export class StockDocAdminResolver {
    constructor(private stockDocService: StockDocService) {}

    @Mutation()
    @Allow(InventoryPermissions.ViewStock as Permission)
    async createStockDoc(
        @Ctx() ctx: RequestContext,
        @Args('input') input: StockDocCreateInput,
    ): Promise<any> {
        return this.stockDocService.create(ctx, input);
    }

    @Query()
    @Allow(InventoryPermissions.ViewStock as Permission)
    async stockMovementLedger(
        @Ctx() ctx: RequestContext,
        @Args('productVariantId', { nullable: true }) productVariantId?: ID,
        @Args('locationId', { nullable: true }) locationId?: ID,
        @Args('bizCode', { nullable: true }) bizCode?: string,
        @Args('orderLineId', { nullable: true }) orderLineId?: ID,
        @Args('page', { nullable: true }) page?: number,
        @Args('pageSize', { nullable: true }) pageSize?: number,
    ): Promise<any> {
        return this.stockDocService.ledger(ctx, {
            productVariantId,
            locationId,
            bizCode,
            orderLineId,
            page,
            pageSize,
        });
    }
}
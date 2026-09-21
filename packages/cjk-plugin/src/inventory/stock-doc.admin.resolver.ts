import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext } from '@vendure/core';
import { InventoryPermissions } from '@vendure/inventory-plugin';
import { StockDocCreateInput, StockDocService } from './stock-doc.service';

/** 管理端：库存单据（采购/移库/盘库/出库） + 库存流水查询 + 单据中心列表 */
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
        @Args('bizType', { nullable: true }) bizType?: string,
        @Args('direction', { nullable: true }) direction?: string,
        @Args('from', { nullable: true }) from?: string,
        @Args('to', { nullable: true }) to?: string,
        @Args('page', { nullable: true }) page?: number,
        @Args('pageSize', { nullable: true }) pageSize?: number,
    ): Promise<any> {
        return this.stockDocService.ledger(ctx, {
            productVariantId,
            locationId,
            bizCode,
            orderLineId,
            bizType,
            direction,
            from,
            to,
            page,
            pageSize,
        });
    }

    @Query()
    @Allow(InventoryPermissions.ViewStock as Permission)
    async stockDocList(
        @Ctx() ctx: RequestContext,
        @Args('type', { nullable: true }) type?: string,
        @Args('page', { nullable: true }) page?: number,
        @Args('pageSize', { nullable: true }) pageSize?: number,
    ): Promise<any> {
        return this.stockDocService.listDocs(ctx, { type, page, pageSize });
    }
}
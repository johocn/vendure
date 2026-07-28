import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext } from '@vendure/core';

import { InventoryPermissions } from './constants';
import { InventoryService } from './inventory.service';

@Resolver()
export class InventoryAdminResolver {
    constructor(private inventoryService: InventoryService) {}

    // ===== 库存查询 =====

    @Query()
    @Allow(InventoryPermissions.ViewStock as Permission)
    async stockLevels(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'locationId', type: () => String, nullable: true }) locationId?: ID,
        @Args({ name: 'page', type: () => Number, nullable: true, defaultValue: 1 }) page?: number,
        @Args({ name: 'pageSize', type: () => Number, nullable: true, defaultValue: 20 }) pageSize?: number,
    ) {
        return this.inventoryService.findStockLevels(ctx, { locationId, page, pageSize });
    }

    @Query()
    @Allow(InventoryPermissions.ViewStock as Permission)
    async stockLocations(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'page', type: () => Number, nullable: true, defaultValue: 1 }) page?: number,
        @Args({ name: 'pageSize', type: () => Number, nullable: true, defaultValue: 20 }) pageSize?: number,
    ) {
        return this.inventoryService.findStockLocations(ctx, { page, pageSize });
    }

    @Query()
    @Allow(InventoryPermissions.ViewStock as Permission)
    async stockMovements(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'productVariantId', type: () => String, nullable: true }) productVariantId?: ID,
        @Args({ name: 'locationId', type: () => String, nullable: true }) locationId?: ID,
        @Args({ name: 'type', type: () => String, nullable: true }) type?: string,
        @Args({ name: 'page', type: () => Number, nullable: true, defaultValue: 1 }) page?: number,
        @Args({ name: 'pageSize', type: () => Number, nullable: true, defaultValue: 20 }) pageSize?: number,
    ) {
        return this.inventoryService.findStockMovements(ctx, { productVariantId, locationId, type, page, pageSize });
    }

    // ===== 入库单 =====

    @Query()
    @Allow(InventoryPermissions.ManageStockIn as Permission)
    async stockInOrders(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'state', type: () => String, nullable: true }) state?: string,
        @Args({ name: 'page', type: () => Number, nullable: true, defaultValue: 1 }) page?: number,
        @Args({ name: 'pageSize', type: () => Number, nullable: true, defaultValue: 20 }) pageSize?: number,
    ) {
        return this.inventoryService.findStockInOrders(ctx, { state, page, pageSize });
    }

    @Query()
    @Allow(InventoryPermissions.ManageStockIn as Permission)
    async stockInOrder(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.inventoryService.findOneStockInOrder(ctx, id);
    }

    @Mutation()
    @Allow(InventoryPermissions.ManageStockIn as Permission)
    async createStockInOrder(@Ctx() ctx: RequestContext, @Args('input') input: any) {
        return this.inventoryService.createStockInOrder(ctx, input);
    }

    @Mutation()
    @Allow(InventoryPermissions.ManageStockIn as Permission)
    async completeStockInOrder(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.inventoryService.completeStockInOrder(ctx, id);
    }

    @Mutation()
    @Allow(InventoryPermissions.ManageStockIn as Permission)
    async cancelStockInOrder(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.inventoryService.cancelStockInOrder(ctx, id);
    }

    // ===== 出库单 =====

    @Query()
    @Allow(InventoryPermissions.ManageStockOut as Permission)
    async stockOutOrders(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'state', type: () => String, nullable: true }) state?: string,
        @Args({ name: 'page', type: () => Number, nullable: true, defaultValue: 1 }) page?: number,
        @Args({ name: 'pageSize', type: () => Number, nullable: true, defaultValue: 20 }) pageSize?: number,
    ) {
        return this.inventoryService.findStockOutOrders(ctx, { state, page, pageSize });
    }

    @Query()
    @Allow(InventoryPermissions.ManageStockOut as Permission)
    async stockOutOrder(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.inventoryService.findOneStockOutOrder(ctx, id);
    }

    @Mutation()
    @Allow(InventoryPermissions.ManageStockOut as Permission)
    async createStockOutOrder(@Ctx() ctx: RequestContext, @Args('input') input: any) {
        return this.inventoryService.createStockOutOrder(ctx, input);
    }

    @Mutation()
    @Allow(InventoryPermissions.ManageStockOut as Permission)
    async completeStockOutOrder(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.inventoryService.completeStockOutOrder(ctx, id);
    }

    @Mutation()
    @Allow(InventoryPermissions.ManageStockOut as Permission)
    async cancelStockOutOrder(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.inventoryService.cancelStockOutOrder(ctx, id);
    }

    // ===== 调拨单 =====

    @Query()
    @Allow(InventoryPermissions.ManageStockMove as Permission)
    async stockMoveOrders(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'state', type: () => String, nullable: true }) state?: string,
        @Args({ name: 'page', type: () => Number, nullable: true, defaultValue: 1 }) page?: number,
        @Args({ name: 'pageSize', type: () => Number, nullable: true, defaultValue: 20 }) pageSize?: number,
    ) {
        return this.inventoryService.findStockMoveOrders(ctx, { state, page, pageSize });
    }

    @Query()
    @Allow(InventoryPermissions.ManageStockMove as Permission)
    async stockMoveOrder(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.inventoryService.findOneStockMoveOrder(ctx, id);
    }

    @Mutation()
    @Allow(InventoryPermissions.ManageStockMove as Permission)
    async createStockMoveOrder(@Ctx() ctx: RequestContext, @Args('input') input: any) {
        return this.inventoryService.createStockMoveOrder(ctx, input);
    }

    @Mutation()
    @Allow(InventoryPermissions.ManageStockMove as Permission)
    async shipStockMoveOrder(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.inventoryService.shipStockMoveOrder(ctx, id);
    }

    @Mutation()
    @Allow(InventoryPermissions.ManageStockMove as Permission)
    async receiveStockMoveOrder(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.inventoryService.receiveStockMoveOrder(ctx, id);
    }

    @Mutation()
    @Allow(InventoryPermissions.ManageStockMove as Permission)
    async completeStockMoveOrder(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.inventoryService.completeStockMoveOrder(ctx, id);
    }

    @Mutation()
    @Allow(InventoryPermissions.ManageStockMove as Permission)
    async cancelStockMoveOrder(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.inventoryService.cancelStockMoveOrder(ctx, id);
    }

    // ===== 盘点单 =====

    @Query()
    @Allow(InventoryPermissions.ManageStocktake as Permission)
    async stocktakeOrders(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'state', type: () => String, nullable: true }) state?: string,
        @Args({ name: 'page', type: () => Number, nullable: true, defaultValue: 1 }) page?: number,
        @Args({ name: 'pageSize', type: () => Number, nullable: true, defaultValue: 20 }) pageSize?: number,
    ) {
        return this.inventoryService.findStocktakeOrders(ctx, { state, page, pageSize });
    }

    @Query()
    @Allow(InventoryPermissions.ManageStocktake as Permission)
    async stocktakeOrder(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.inventoryService.findOneStocktakeOrder(ctx, id);
    }

    @Mutation()
    @Allow(InventoryPermissions.ManageStocktake as Permission)
    async createStocktakeOrder(@Ctx() ctx: RequestContext, @Args('input') input: any) {
        return this.inventoryService.createStocktakeOrder(ctx, input);
    }

    @Mutation()
    @Allow(InventoryPermissions.ManageStocktake as Permission)
    async startCountingStocktake(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.inventoryService.startCountingStocktake(ctx, id);
    }

    @Mutation()
    @Allow(InventoryPermissions.ManageStocktake as Permission)
    async submitStocktakeCount(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args('counts') counts: any[],
    ) {
        return this.inventoryService.submitStocktakeCount(ctx, id, counts);
    }

    @Mutation()
    @Allow(InventoryPermissions.ManageStocktake as Permission)
    async reconcileStocktakeLine(
        @Ctx() ctx: RequestContext,
        @Args('orderId') orderId: ID,
        @Args('lineId') lineId: ID,
    ) {
        return this.inventoryService.reconcileStocktakeLine(ctx, orderId, lineId);
    }

    @Mutation()
    @Allow(InventoryPermissions.ManageStocktake as Permission)
    async completeStocktakeOrder(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.inventoryService.completeStocktakeOrder(ctx, id);
    }

    @Mutation()
    @Allow(InventoryPermissions.ManageStocktake as Permission)
    async cancelStocktakeOrder(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.inventoryService.cancelStocktakeOrder(ctx, id);
    }
}

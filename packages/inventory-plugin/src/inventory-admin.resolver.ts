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

    @Mutation()
    @Allow(InventoryPermissions.ViewStock as Permission)
    async setVariantStock(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'productVariantId', type: () => String }) productVariantId: ID,
        @Args({ name: 'stockLocationId', type: () => String }) stockLocationId: ID,
        @Args({ name: 'stockOnHand', type: () => Number }) stockOnHand: number,
    ) {
        await this.inventoryService.setStockForVariant(ctx, productVariantId, stockLocationId, stockOnHand);
        return true;
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

    @Query()
    @Allow(InventoryPermissions.ViewStock as Permission)
    async stockLedger(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'productVariantId', type: () => String, nullable: true }) productVariantId?: ID,
        @Args({ name: 'locationId', type: () => String, nullable: true }) locationId?: ID,
        @Args({ name: 'bizType', type: () => String, nullable: true }) bizType?: string,
        @Args({ name: 'bizCode', type: () => String, nullable: true }) bizCode?: string,
        @Args({ name: 'orderLineId', type: () => String, nullable: true }) orderLineId?: ID,
        @Args({ name: 'page', type: () => Number, nullable: true, defaultValue: 1 }) page?: number,
        @Args({ name: 'pageSize', type: () => Number, nullable: true, defaultValue: 20 }) pageSize?: number,
    ) {
        return this.inventoryService.findStockLedger(ctx, {
            productVariantId, locationId, bizType, bizCode, orderLineId, page, pageSize,
        });
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

    // ===== 供应商 =====
    @Query()
    @Allow(InventoryPermissions.ManageSupplier as Permission)
    async suppliers(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'keyword', type: () => String, nullable: true }) keyword?: string,
        @Args({ name: 'options', type: () => Object, nullable: true }) options?: { skip?: number; take?: number },
    ) {
        const page = options?.skip != null ? Math.floor(options.skip / (options.take ?? 20)) + 1 : 1;
        return this.inventoryService.findSuppliers(ctx, { keyword, page, pageSize: options?.take ?? 20 });
    }

    @Query()
    @Allow(InventoryPermissions.ManageSupplier as Permission)
    async supplier(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.inventoryService.findOneSupplier(ctx, id);
    }

    @Mutation()
    @Allow(InventoryPermissions.ManageSupplier as Permission)
    async createSupplier(@Ctx() ctx: RequestContext, @Args('input') input: any) {
        return this.inventoryService.createSupplier(ctx, input);
    }

    @Mutation()
    @Allow(InventoryPermissions.ManageSupplier as Permission)
    async updateSupplier(@Ctx() ctx: RequestContext, @Args('id') id: ID, @Args('input') input: any) {
        return this.inventoryService.updateSupplier(ctx, id, input);
    }

    @Mutation()
    @Allow(InventoryPermissions.ManageSupplier as Permission)
    async deleteSupplier(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.inventoryService.deleteSupplier(ctx, id);
    }

    // ===== 采购单 =====
    @Query()
    @Allow(InventoryPermissions.ManagePurchase as Permission)
    async purchaseOrders(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'state', type: () => String, nullable: true }) state?: string,
        @Args({ name: 'options', type: () => Object, nullable: true }) options?: { skip?: number; take?: number },
    ) {
        const page = options?.skip != null ? Math.floor(options.skip / (options.take ?? 20)) + 1 : 1;
        return this.inventoryService.findPurchaseOrders(ctx, { state, page, pageSize: options?.take ?? 20 });
    }

    @Query()
    @Allow(InventoryPermissions.ManagePurchase as Permission)
    async purchaseOrder(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.inventoryService.findOnePurchaseOrder(ctx, id);
    }

    @Mutation()
    @Allow(InventoryPermissions.ManagePurchase as Permission)
    async createPurchaseOrder(@Ctx() ctx: RequestContext, @Args('input') input: any) {
        return this.inventoryService.createPurchaseOrder(ctx, input);
    }

    @Mutation()
    @Allow(InventoryPermissions.ManagePurchase as Permission)
    async placePurchaseOrder(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.inventoryService.placePurchaseOrder(ctx, id);
    }

    @Mutation()
    @Allow(InventoryPermissions.ManagePurchase as Permission)
    async receivePurchaseOrder(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args('lines') lines: any[],
    ) {
        return this.inventoryService.receivePurchaseOrder(ctx, id, lines);
    }

    @Mutation()
    @Allow(InventoryPermissions.ManagePurchase as Permission)
    async completePurchaseOrder(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.inventoryService.completePurchaseOrder(ctx, id);
    }

    @Mutation()
    @Allow(InventoryPermissions.ManagePurchase as Permission)
    async cancelPurchaseOrder(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.inventoryService.cancelPurchaseOrder(ctx, id);
    }
}

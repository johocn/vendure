import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext } from '@vendure/core';
import { InventoryPermissions } from '@vendure/inventory-plugin';
import { VirtualPhysicalStockService } from './virtual-physical-stock.service';
import { InventoryAlertRuleInput, InventoryAlertRuleService } from './inventory-alert-rule.service';
import { InventoryStockPageInput, InventoryStockService } from './inventory-stock.service';

/** 管理端库存配置：变体 × 物理仓绑定 + 租户库存仓管理 + 库存明细聚合页 + 预警规则 */
@Resolver()
export class InventoryAdminResolver {
    constructor(
        private virtualPhysicalStockService: VirtualPhysicalStockService,
        private inventoryStockService: InventoryStockService,
        private inventoryAlertRuleService: InventoryAlertRuleService,
    ) {}

    @Mutation()
    @Allow(InventoryPermissions.ViewStock as Permission)
    async setVariantBindings(
        @Ctx() ctx: RequestContext,
        @Args('variantId') variantId: ID,
        @Args('bindings') bindings: Array<{ locationId: ID; isDefault: boolean }>,
    ) {
        return this.virtualPhysicalStockService.setVariantBindings(ctx, variantId, bindings);
    }

    /** 租户库存方案概览（开关口径 + 系统仓落点 + 仓清单） */
    @Query()
    @Allow(Permission.ReadCatalog, Permission.ReadStockLocation)
    async tenantInventoryOverview(@Ctx() ctx: RequestContext) {
        return this.virtualPhysicalStockService.getTenantInventoryOverview(ctx);
    }

    /** 幂等补建系统仓（虚拟仓恒在；开关开启时补默认物理仓），供后台「一键初始化」与自愈 */
    @Mutation()
    @Allow(Permission.CreateStockLocation, Permission.UpdateStockLocation)
    async ensureTenantInventoryLocations(@Ctx() ctx: RequestContext) {
        return this.virtualPhysicalStockService.ensureTenantInventoryLocations(ctx);
    }

    /** 新建租户物理仓（服务端自动编码 + 归属校验 + 强制 physical） */
    @Mutation()
    @Allow(Permission.CreateStockLocation)
    async createTenantStockLocation(
        @Ctx() ctx: RequestContext,
        @Args('input') input: { name: string },
    ) {
        return this.virtualPhysicalStockService.createTenantPhysicalLocation(ctx, input as any);
    }

    /** 更新租户仓（名称/配送方式/服务城市/坐标；编码与性质不可改） */
    @Mutation()
    @Allow(Permission.UpdateStockLocation)
    async updateTenantStockLocation(
        @Ctx() ctx: RequestContext,
        @Args('input') input: { id: ID },
    ) {
        return this.virtualPhysicalStockService.updateTenantPhysicalLocation(ctx, input as any);
    }

    /** 删除租户仓（系统仓不可删） */
    @Mutation()
    @Allow(Permission.DeleteStockLocation)
    async deleteTenantStockLocation(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
    ) {
        return this.virtualPhysicalStockService.deleteTenantPhysicalLocation(ctx, id);
    }

    /** 库存明细聚合页：KPI + 分桶计数 + 明细行（服务端过滤/排序/分页） */
    @Query()
    @Allow(InventoryPermissions.ViewStock as Permission, Permission.ReadCatalog, Permission.ReadStockLocation)
    async inventoryStockPage(
        @Ctx() ctx: RequestContext,
        @Args('input', { nullable: true }) input?: InventoryStockPageInput,
    ) {
        return this.inventoryStockService.page(ctx, input ?? null);
    }

    /** 预警规则列表（指定仓；缺省 → 该 SKU 全仓通用规则） */
    @Query()
    @Allow(InventoryPermissions.ViewStock as Permission, Permission.ReadCatalog, Permission.ReadStockLocation)
    async inventoryAlertRules(
        @Ctx() ctx: RequestContext,
        @Args('locationId', { nullable: true }) locationId?: ID,
    ) {
        return this.inventoryAlertRuleService.list(ctx, locationId ?? null);
    }

    /** 预警规则保存（幂等 upsert；返回该仓最新规则列表） */
    @Mutation()
    @Allow(Permission.UpdateStockLocation)
    async saveInventoryAlertRules(
        @Ctx() ctx: RequestContext,
        @Args('items') items: InventoryAlertRuleInput[],
        @Args('locationId', { nullable: true }) locationId?: ID,
    ) {
        return this.inventoryAlertRuleService.save(ctx, locationId ?? null, items ?? []);
    }
}
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext } from '@vendure/core';
import { InventoryPermissions } from '@vendure/inventory-plugin';
import { VirtualPhysicalStockService } from './virtual-physical-stock.service';

/** 管理端库存配置：变体 × 物理仓绑定（物理驱动变体由此开启） */
@Resolver()
export class InventoryAdminResolver {
    constructor(private virtualPhysicalStockService: VirtualPhysicalStockService) {}

    @Mutation()
    @Allow(InventoryPermissions.ViewStock as Permission)
    async setVariantBindings(
        @Ctx() ctx: RequestContext,
        @Args('variantId') variantId: ID,
        @Args('bindings') bindings: Array<{ locationId: ID; isDefault: boolean }>,
    ) {
        return this.virtualPhysicalStockService.setVariantBindings(ctx, variantId, bindings);
    }
}

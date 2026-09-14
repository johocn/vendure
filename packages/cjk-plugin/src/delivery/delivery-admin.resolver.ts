import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext } from '@vendure/core';
import { InventoryService } from '@vendure/inventory-plugin';
import { DeliveryRecordService } from './delivery-record.service';
import { DeliveryState } from './delivery-state';

@Resolver()
export class DeliveryAdminResolver {
    constructor(
        private deliveryRecordService: DeliveryRecordService,
        private inventoryService: InventoryService,
    ) {}

    @Query()
    @Allow(Permission.ReadOrder, Permission.SuperAdmin)
    async deliveryRecords(@Ctx() ctx: RequestContext, @Args('orderId', { nullable: true }) orderId?: ID) {
        return this.deliveryRecordService.findByOrder(ctx, orderId);
    }

    @Mutation()
    @Allow(Permission.UpdateOrder, Permission.SuperAdmin)
    async deliveryTransition(@Ctx() ctx: RequestContext, @Args('id') id: ID, @Args('to') to: DeliveryState) {
        return this.deliveryRecordService.transition(ctx, id, to);
    }

    @Mutation()
    @Allow(Permission.UpdateOrder, Permission.SuperAdmin)
    async deliverySetExpress(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args('expressCompany') expressCompany: string,
        @Args('trackingNo') trackingNo: string,
    ) {
        return this.deliveryRecordService.setExpress(ctx, id, expressCompany, trackingNo);
    }

    @Mutation()
    @Allow(Permission.UpdateOrder, Permission.SuperAdmin)
    async deliveryAssignStaff(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args('staffId') staffId: string,
        @Args('staffName', { nullable: true }) staffName?: string,
    ) {
        return this.deliveryRecordService.assignStaff(ctx, id, staffId, staffName);
    }

    @Mutation()
    @Allow(Permission.UpdateOrder, Permission.SuperAdmin)
    async deliveryCreateTransfer(
        @Ctx() ctx: RequestContext,
        @Args('orderId') orderId: ID,
        @Args('fromLocationId') fromLocationId: ID,
        @Args('toLocationId') toLocationId: ID,
        @Args('itemsJson') itemsJson: string,
    ) {
        return this.deliveryRecordService.createTransfer(ctx, {
            orderId,
            fromLocationId,
            toLocationId,
            items: JSON.parse(itemsJson),
        });
    }

    @Mutation()
    @Allow(Permission.UpdateOrder, Permission.SuperAdmin)
    async deliveryTransferArrived(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.deliveryRecordService.markTransferArrived(ctx, id, (c, v, l, d, r, m) =>
            this.inventoryService.adjustStockPublic(c, v, l, d, r, m),
        );
    }
}

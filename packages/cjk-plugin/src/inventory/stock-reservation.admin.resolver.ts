import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext } from '@vendure/core';
import { ReservationSplit, StockReservationService } from './stock-reservation.service';

@Resolver()
export class StockReservationAdminResolver {
    constructor(private service: StockReservationService) {}

    @Query()
    @Allow(Permission.ReadCatalog as Permission)
    async reservations(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'status', type: () => String, nullable: true }) status?: string,
        @Args('variantId', { nullable: true }) variantId?: ID,
        @Args('orderId', { nullable: true }) orderId?: ID,
        @Args({ name: 'page', type: () => Number, nullable: true, defaultValue: 1 }) page?: number,
        @Args({ name: 'pageSize', type: () => Number, nullable: true, defaultValue: 20 }) pageSize?: number,
    ) {
        return this.service.list(ctx, { status, variantId, orderId, page, pageSize });
    }

    @Query()
    @Allow(Permission.ReadCatalog as Permission)
    async reservation(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        const res = await this.service.get(ctx, Number(id));
        const items = await this.service.items(ctx, Number(id));
        return { ...res, items };
    }

    @Query()
    @Allow(Permission.ReadCatalog as Permission)
    async reservationReconcile(@Ctx() ctx: RequestContext) {
        return this.service.reconcileScan(ctx);
    }

    @Mutation()
    @Allow(Permission.UpdateCatalog as Permission)
    async allocateReservation(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args({ name: 'splits', type: () => [Object] }) splits: ReservationSplit[],
    ) {
        const res = await this.service.allocate(ctx, Number(id), splits);
        const items = await this.service.items(ctx, Number(id));
        return { ...res, items };
    }

    @Mutation()
    @Allow(Permission.UpdateCatalog as Permission)
    async fulfillReservationItem(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args({ name: 'quantity', type: () => Number, nullable: true }) quantity?: number,
    ) {
        return this.service.fulfillItem(ctx, Number(id), quantity);
    }

    @Mutation()
    @Allow(Permission.UpdateCatalog as Permission)
    async releaseReservation(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.service.release(ctx, Number(id), { returnPhysical: false });
    }
}

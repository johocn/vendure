import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Ctx, ID, RequestContext } from '@vendure/core';
import { R2MarkService } from './r2-mark.service';
import { RiderTaskService } from './rider-task.service';

@Resolver()
export class RiderTaskShopResolver {
    constructor(private riderTaskService: RiderTaskService, private r2Mark: R2MarkService) {}

    /** 需登录骑手：service 内部 assertApprovedRider，未登录/未批准/信用分不足抛 ForbiddenError。 */
    @Query()
    async campusMyTasks(@Ctx() ctx: RequestContext, @Args('status', { nullable: true }) status?: string) {
        return this.riderTaskService.myTasks(ctx, status);
    }

    /** 公开只读：C 端订单跟踪骑手卡（姓名+信用分，不含联系方式） */
    @Query()
    async campusOrderRider(@Ctx() ctx: RequestContext, @Args('orderId') orderId: ID) {
        return this.riderTaskService.orderRider(ctx, orderId);
    }

    @Mutation()
    async campusStartTask(@Ctx() ctx: RequestContext, @Args('orderId') orderId: ID) {
        return this.riderTaskService.start(ctx, orderId);
    }

    /** 转单回大厅；已取货必须拍照交接。错误语义：未登录/非本人 ForbiddenError，状态/缺照片 UserInputError。 */
    @Mutation()
    async campusTransferTask(
        @Ctx() ctx: RequestContext,
        @Args('orderId') orderId: ID,
        @Args('photos') photos: string[],
        @Args('note', { nullable: true }) note?: string,
    ) {
        return this.riderTaskService.transfer(ctx, orderId, photos, note);
    }

    @Mutation()
    async campusDeliverTask(
        @Ctx() ctx: RequestContext,
        @Args('orderId') orderId: ID,
        @Args('photos') photos: string[],
        @Args('note', { nullable: true }) note?: string,
    ) {
        return this.riderTaskService.deliver(ctx, orderId, photos, note);
    }

    @Mutation()
    async campusReportException(
        @Ctx() ctx: RequestContext,
        @Args('orderId') orderId: ID,
        @Args('type') type: string,
        @Args('photos') photos: string[],
        @Args('note', { nullable: true }) note?: string,
    ) {
        return this.riderTaskService.reportException(ctx, orderId, type, photos, note);
    }

    /** R2 快递单到校确认：本人 + fulfillmentRoute='R2'，service 内校验，违规抛 Forbidden/UserInputError。 */
    @Mutation()
    async campusMarkArrived(@Ctx() ctx: RequestContext, @Args('orderId') orderId: ID) {
        return this.r2Mark.markArrived(ctx, orderId);
    }
}

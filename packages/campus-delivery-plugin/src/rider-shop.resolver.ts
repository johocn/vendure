import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Ctx, ID, RequestContext } from '@vendure/core';
import { CapacityService } from './capacity.service';
import { CampusConfigService } from './campus-config.service';
import { RiderService } from './rider.service';

@Resolver()
export class RiderShopResolver {
    constructor(
        private riderService: RiderService,
        private configService: CampusConfigService,
        private capacity: CapacityService,
    ) {}

    /** 需登录：service 内部校验当前顾客，未登录抛 ForbiddenError。 */
    @Mutation()
    async applyRider(
        @Ctx() ctx: RequestContext,
        @Args('realName') realName: string,
        @Args('studentNo') studentNo: string,
        @Args('campus') campus: string,
        @Args('idImg', { nullable: true }) idImg?: string,
    ) {
        return this.riderService.applyRider(ctx, { realName, studentNo, campus, idImg });
    }

    @Query()
    async myRiderProfile(@Ctx() ctx: RequestContext) {
        return this.riderService.myRiderProfile(ctx);
    }

    /** 骑手上下线开关（大厅轮询页 15s 轮询续命） */
    @Mutation()
    async campusRiderOnline(@Ctx() ctx: RequestContext, @Args('online') online: boolean) {
        return this.riderService.setOnline(ctx, online);
    }

    /** 骑手心跳（30s 定时调），带骑手资格校验 */
    @Mutation()
    async campusRiderHeartbeat(@Ctx() ctx: RequestContext) {
        return this.capacity.heartbeat(ctx);
    }

    /** T0 运力预检：C 端下单前提示「运力紧张」 */
    @Query()
    async campusCapacityCheck(@Ctx() ctx: RequestContext) {
        return this.capacity.capacityCheck(ctx);
    }

    // 公开只读：C 端选楼用
    @Query()
    async campusZones(@Ctx() ctx: RequestContext) {
        return this.configService.listZones(ctx);
    }

    @Query()
    async campusBuildings(@Ctx() ctx: RequestContext, @Args({ name: 'zoneId', nullable: true }) zoneId?: ID) {
        return this.configService.listBuildings(zoneId != null ? Number(zoneId) : undefined);
    }
}

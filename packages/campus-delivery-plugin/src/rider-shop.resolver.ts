import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Ctx, ID, RequestContext } from '@vendure/core';
import { CampusConfigService } from './campus-config.service';
import { RiderService } from './rider.service';

@Resolver()
export class RiderShopResolver {
    constructor(private riderService: RiderService, private configService: CampusConfigService) {}

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

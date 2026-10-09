import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, PaginatedList, Permission, RequestContext, Transaction } from '@vendure/core';

import { LotteryPrize } from './lottery-prize.entity';
import { LotteryRecord } from './lottery-record.entity';
import { LotteryService } from './lottery.service';
import {
    CreateLotteryPrizeInput,
    LotteryDrawResult,
    LotteryPrizeListOptions,
    LotteryRecordListOptions,
    UpdateLotteryPrizeInput,
} from './types';

@Resolver()
export class LotteryShopResolver {
    constructor(private lotteryService: LotteryService) {}

    /** 未登录可看奖品列表（C 端九宫格渲染），不加 @Allow。 */
    @Query()
    async myLotteryPrizes(@Ctx() ctx: RequestContext): Promise<LotteryPrize[]> {
        return this.lotteryService.myPrizes(ctx);
    }

    @Query()
    @Allow(Permission.Authenticated)
    async myLotteryRecords(
        @Ctx() ctx: RequestContext,
        @Args('options', { nullable: true }) options?: LotteryRecordListOptions,
    ): Promise<PaginatedList<LotteryRecord>> {
        return this.lotteryService.myRecords(ctx, options);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.Authenticated)
    async drawLottery(@Ctx() ctx: RequestContext): Promise<LotteryDrawResult> {
        return this.lotteryService.draw(ctx);
    }
}

@Resolver()
export class LotteryAdminResolver {
    constructor(private lotteryService: LotteryService) {}

    @Query()
    @Allow(Permission.ReadSettings)
    async lotteryPrizes(
        @Ctx() ctx: RequestContext,
        @Args('options', { nullable: true }) options?: LotteryPrizeListOptions,
    ): Promise<PaginatedList<LotteryPrize>> {
        return this.lotteryService.adminPrizes(ctx, options);
    }

    @Query()
    @Allow(Permission.ReadSettings)
    async lotteryRecords(
        @Ctx() ctx: RequestContext,
        @Args('options', { nullable: true }) options?: LotteryRecordListOptions,
    ): Promise<PaginatedList<LotteryRecord>> {
        return this.lotteryService.adminRecords(ctx, options);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateSettings)
    async createLotteryPrize(
        @Ctx() ctx: RequestContext,
        @Args('input') input: CreateLotteryPrizeInput,
    ): Promise<LotteryPrize> {
        return this.lotteryService.createPrize(ctx, input);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateSettings)
    async updateLotteryPrize(
        @Ctx() ctx: RequestContext,
        @Args('input') input: UpdateLotteryPrizeInput,
    ): Promise<LotteryPrize> {
        return this.lotteryService.updatePrize(ctx, input);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateSettings)
    async deleteLotteryPrize(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<boolean> {
        return this.lotteryService.deletePrize(ctx, id);
    }
}

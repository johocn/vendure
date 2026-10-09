import { ID, PaginatedList, RequestContext } from '@vendure/core';
import { LotteryPrize } from './lottery-prize.entity';
import { LotteryRecord } from './lottery-record.entity';
import { LotteryService } from './lottery.service';
import { CreateLotteryPrizeInput, LotteryDrawResult, LotteryPrizeListOptions, LotteryRecordListOptions, UpdateLotteryPrizeInput } from './types';
export declare class LotteryShopResolver {
    private lotteryService;
    constructor(lotteryService: LotteryService);
    /** 未登录可看奖品列表（C 端九宫格渲染），不加 @Allow。 */
    myLotteryPrizes(ctx: RequestContext): Promise<LotteryPrize[]>;
    myLotteryRecords(ctx: RequestContext, options?: LotteryRecordListOptions): Promise<PaginatedList<LotteryRecord>>;
    drawLottery(ctx: RequestContext): Promise<LotteryDrawResult>;
}
export declare class LotteryAdminResolver {
    private lotteryService;
    constructor(lotteryService: LotteryService);
    lotteryPrizes(ctx: RequestContext, options?: LotteryPrizeListOptions): Promise<PaginatedList<LotteryPrize>>;
    lotteryRecords(ctx: RequestContext, options?: LotteryRecordListOptions): Promise<PaginatedList<LotteryRecord>>;
    createLotteryPrize(ctx: RequestContext, input: CreateLotteryPrizeInput): Promise<LotteryPrize>;
    updateLotteryPrize(ctx: RequestContext, input: UpdateLotteryPrizeInput): Promise<LotteryPrize>;
    deleteLotteryPrize(ctx: RequestContext, id: ID): Promise<boolean>;
}

import { CustomerService, ID, ListQueryBuilder, PaginatedList, RequestContext, TransactionalConnection } from '@vendure/core';
import { MemberLevelService } from '@vendure/member-level-plugin';
import { LotteryPrize } from './lottery-prize.entity';
import { LotteryRecord } from './lottery-record.entity';
import { CreateLotteryPrizeInput, LotteryDrawResult, LotteryPrizeListOptions, LotteryRecordListOptions, UpdateLotteryPrizeInput } from './types';
export declare class LotteryService {
    private connection;
    private listQueryBuilder;
    private customerService;
    /** 积分桥软依赖（checkin-plugin 同款直注，需与 MemberLevelPlugin 同容器） */
    private memberService;
    constructor(connection: TransactionalConnection, listQueryBuilder: ListQueryBuilder, customerService: CustomerService, 
    /** 积分桥软依赖（checkin-plugin 同款直注，需与 MemberLevelPlugin 同容器） */
    memberService: MemberLevelService);
    /** 解析当前登录顾客（checkin.service requireCustomer 同款口径）。 */
    private requireCustomer;
    /**
     * 参与开奖的奖品全集（shop 展示与 draw 共用同一份，保证 prizeIndex 同源）：
     * enabled + 当前渠道或全渠道 + 库存可用（null=不限量），按 sort ASC/id ASC 排序。
     * weight <= 0 的奖项保留在下标序列中（仅展示，不参与加权抽取）。
     */
    private enabledPrizes;
    /** shop：九宫格奖品列表（启用中，含 consume；顺序与开奖 prizeIndex 同源）。未登录可访问。 */
    myPrizes(ctx: RequestContext): Promise<LotteryPrize[]>;
    /**
     * 服务端开奖：按权重随机取奖 → spendPoints 桥扣积分（余额不足抛 UserInputError，事务回滚）
     * → 库存原子递减 → 落抽奖记录。resolver 端 @Transaction() 包裹。
     */
    draw(ctx: RequestContext): Promise<LotteryDrawResult>;
    /** shop：我的抽奖记录（customerId + channelId 隔离，id DESC）。 */
    myRecords(ctx: RequestContext, options?: LotteryRecordListOptions): Promise<PaginatedList<LotteryRecord>>;
    /** admin：奖品分页（当前渠道或全渠道，sort ASC/id ASC）。 */
    adminPrizes(ctx: RequestContext, options?: LotteryPrizeListOptions): Promise<PaginatedList<LotteryPrize>>;
    /** admin：全量抽奖记录分页（id DESC）。 */
    adminRecords(ctx: RequestContext, options?: LotteryRecordListOptions): Promise<PaginatedList<LotteryRecord>>;
    /** admin：创建奖品（归属当前渠道）。 */
    createPrize(ctx: RequestContext, input: CreateLotteryPrizeInput): Promise<LotteryPrize>;
    /** admin：更新奖品（仅覆盖传入字段；image/stock 传 null 可清空）。 */
    updatePrize(ctx: RequestContext, input: UpdateLotteryPrizeInput): Promise<LotteryPrize>;
    /** admin：删除奖品。 */
    deletePrize(ctx: RequestContext, id: ID): Promise<boolean>;
}

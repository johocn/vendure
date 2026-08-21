import { CustomerService, ID, RequestContext, TransactionalConnection } from '@vendure/core';
import { MemberLevelService } from '@vendure/member-level-plugin';
import { CheckinTodayInfo, CreditResult, TaskSummary } from './types';
export declare class CheckinService {
    private connection;
    private customerService;
    private memberService;
    private readonly options;
    constructor(connection: TransactionalConnection, customerService: CustomerService, memberService: MemberLevelService, options: {
        defaultRewards?: Record<string, number>;
    });
    /** 解析当前登录顾客（复用 member/review 口径）。 */
    private requireCustomer;
    /** 读取某渠道全部奖励值（channel 自定义字段 ?? options 默认）。 */
    private rewardMap;
    private reward;
    /** 本地时区日期串 YYYY-MM-DD（可偏移天数） */
    private localDateStr;
    /** 统一发奖：走 member-level 记账（积分/成长值），幂等由调用方唯一键保证。 */
    private credit;
    /** 每日签到（幂等：同渠道同日已签则返回 already 不重复发奖）。 */
    checkin(ctx: RequestContext): Promise<CreditResult>;
    /** 今日签到状态。 */
    checkinToday(ctx: RequestContext): Promise<CheckinTodayInfo>;
    /** 主动领奖（每日任务 + 账户成就 ONCE）。 */
    claimTask(ctx: RequestContext, taskCode: string): Promise<CreditResult>;
    /** 订单 Delivered 事件 → 计算该顾客累计单数/消费额 → 命中里程碑自动发奖（ONCE 幂等）。 */
    awardMilestones(ctx: RequestContext, customerId: ID): Promise<void>;
    /** 我的任务列表（主动任务 + reach_level + 里程碑），返回状态。 */
    myTasks(ctx: RequestContext): Promise<TaskSummary[]>;
}

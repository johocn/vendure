import { Inject, Injectable } from '@nestjs/common';
import {
    Customer,
    CustomerService,
    EntityNotFoundError,
    ID,
    Logger,
    Order,
    RequestContext,
    TransactionalConnection,
    UnauthorizedError,
} from '@vendure/core';
import { MemberLevelService } from '@vendure/member-level-plugin';

import { CheckinRecord } from './checkin-record.entity';
import { TaskRecord } from './task-record.entity';
import { CHECKIN_PLUGIN_OPTIONS, loggerCtx } from './constants';
import { CheckinTodayInfo, CreditResult, TaskSummary } from './types';

type TaskRepeatability = 'DAILY' | 'ONCE';
type TaskType = 'ACCOUNT' | 'MILESTONE';

interface TaskDef {
    code: string;
    type: TaskType;
    repeatability: TaskRepeatability;
    pointsKey: string;
    growthKey: string;
    /** 主动领奖前置条件（返回 false 表示未达标） */
    preMet?: (ctx: RequestContext, customer: Customer) => boolean;
}

const ACTIVE_TASKS: TaskDef[] = [
    { code: 'daily_share', type: 'ACCOUNT', repeatability: 'DAILY', pointsKey: 'taskSharePoints', growthKey: 'taskShareGrowth' },
    { code: 'daily_login', type: 'ACCOUNT', repeatability: 'DAILY', pointsKey: 'taskLoginPoints', growthKey: 'taskLoginGrowth' },
    { code: 'daily_profile', type: 'ACCOUNT', repeatability: 'DAILY', pointsKey: 'taskProfilePoints', growthKey: 'taskProfileGrowth' },
    {
        code: 'bind_phone',
        type: 'ACCOUNT',
        repeatability: 'ONCE',
        pointsKey: 'taskBindPhonePoints',
        growthKey: 'taskBindPhoneGrowth',
        preMet: (_ctx, customer) => Boolean((customer as any).phoneNumber),
    },
];

const MILESTONE_OK_STATES = ['Delivered', 'Completed'];

const REWARD_KEYS = [
    'checkinPoints', 'checkinGrowth', 'checkinStreakThreshold', 'checkinStreakBonusPoints', 'checkinStreakBonusGrowth',
    'taskSharePoints', 'taskShareGrowth', 'taskLoginPoints', 'taskLoginGrowth', 'taskProfilePoints', 'taskProfileGrowth',
    'taskBindPhonePoints', 'taskBindPhoneGrowth',
    'taskReachLevelThreshold', 'taskReachLevelPoints', 'taskReachLevelGrowth',
    'taskFirstOrderPoints', 'taskFirstOrderGrowth',
    'taskOrderCountThreshold', 'taskOrderCountPoints', 'taskOrderCountGrowth',
    'taskOrderAmountThreshold', 'taskOrderAmountPoints', 'taskOrderAmountGrowth',
];

@Injectable()
export class CheckinService {
    constructor(
        private connection: TransactionalConnection,
        private customerService: CustomerService,
        private memberService: MemberLevelService,
        @Inject(CHECKIN_PLUGIN_OPTIONS) private readonly options: { defaultRewards?: Record<string, number> },
    ) {}

    /** 解析当前登录顾客（复用 member/review 口径）。 */
    private async requireCustomer(ctx: RequestContext): Promise<Customer> {
        if (!ctx.activeUserId) {
            throw new UnauthorizedError();
        }
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer) {
            throw new EntityNotFoundError('Customer', ctx.activeUserId);
        }
        return customer;
    }

    /** 读取某渠道全部奖励值（channel 自定义字段 ?? options 默认）。 */
    private rewardMap(ctx: RequestContext): Record<string, number> {
        const cf = ((ctx as any).channel as any)?.customFields ?? {};
        const defaults = (this.options as any).defaultRewards ?? {};
        const result: Record<string, number> = {};
        for (const key of REWARD_KEYS) {
            const channelVal = cf[key];
            const optVal = defaults[key];
            result[key] = channelVal != null ? Number(channelVal) : optVal != null ? Number(optVal) : 0;
        }
        return result;
    }

    private reward(ctx: RequestContext, key: string): number {
        return this.rewardMap(ctx)[key] ?? 0;
    }

    /** 本地时区日期串 YYYY-MM-DD（可偏移天数） */
    private localDateStr(offsetDays = 0): string {
        const d = new Date();
        d.setDate(d.getDate() + offsetDays);
        const p = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    }

    /** 统一发奖：走 member-level 记账（积分/成长值），幂等由调用方唯一键保证。 */
    private async credit(ctx: RequestContext, customerId: ID, points: number, growth: number, source: string): Promise<void> {
        if (points > 0) {
            await this.memberService.addPoints(ctx, customerId, points, null, source, null);
        }
        if (growth > 0) {
            await this.memberService.addGrowthValue(ctx, customerId, growth, source);
        }
        Logger.info(`Checkin credit ${source}: +${points}P +${growth}G -> customer ${customerId}`, loggerCtx);
    }

    /** 每日签到（幂等：同渠道同日已签则返回 already 不重复发奖）。 */
    async checkin(ctx: RequestContext): Promise<CreditResult> {
        const customer = await this.requireCustomer(ctx);
        const channelId = ctx.channelId as number;
        const customerId = customer.id as number;
        const today = this.localDateStr();
        const repo = this.connection.getRepository(ctx, CheckinRecord);

        const existing = await repo.findOne({ where: { customerId, checkinDate: today, channelId } as any });
        if (existing) {
            return { success: false, reason: 'already', streak: existing.streak };
        }

        const yesterday = this.localDateStr(-1);
        const last = await repo.findOne({
            where: { customerId, checkinDate: yesterday, channelId } as any,
            order: { id: 'DESC' } as any,
        });
        const prevStreak = last?.streak ?? 0;
        const streak = prevStreak > 0 ? prevStreak + 1 : 1;

        const r = this.rewardMap(ctx);
        const basePoints = r.checkinPoints;
        const baseGrowth = r.checkinGrowth;
        const threshold = r.checkinStreakThreshold;
        const bonusPoints = threshold > 0 && streak >= threshold ? r.checkinStreakBonusPoints : 0;
        const bonusGrowth = threshold > 0 && streak >= threshold ? r.checkinStreakBonusGrowth : 0;
        const points = basePoints + bonusPoints;
        const growth = baseGrowth + bonusGrowth;

        await repo.save(repo.create({
            channelId,
            customerId,
            checkinDate: today,
            points,
            growth,
            streak,
        }));
        await this.credit(ctx, customer.id, points, growth, `checkin:${today}`);
        return { success: true, points, growth, streak };
    }

    /** 今日签到状态。 */
    async checkinToday(ctx: RequestContext): Promise<CheckinTodayInfo> {
        const customer = await this.requireCustomer(ctx);
        const channelId = ctx.channelId as number;
        const repo = this.connection.getRepository(ctx, CheckinRecord);
        const today = await repo.findOne({
            where: { customerId: customer.id as number, checkinDate: this.localDateStr(), channelId } as any,
        });
        return { checkedIn: Boolean(today), streak: today?.streak ?? 0, canCheckin: !today };
    }

    /** 主动领奖（每日任务 + 账户成就 ONCE）。 */
    async claimTask(ctx: RequestContext, taskCode: string): Promise<CreditResult> {
        const customer = await this.requireCustomer(ctx);
        const channelId = ctx.channelId as number;
        const task = ACTIVE_TASKS.find(t => t.code === taskCode);
        if (!task) {
            return { success: false, reason: 'unknown_task' };
        }
        if (task.preMet && !task.preMet(ctx, customer)) {
            return { success: false, reason: 'not_met' };
        }
        const period = task.repeatability === 'DAILY' ? this.localDateStr() : null;
        const repo = this.connection.getRepository(ctx, TaskRecord);
        const existing = await repo.findOne({
            where: { customerId: customer.id as number, taskCode, channelId, period } as any,
        });
        if (existing) {
            return { success: false, reason: 'already' };
        }
        const r = this.rewardMap(ctx);
        const points = r[task.pointsKey] ?? 0;
        const growth = r[task.growthKey] ?? 0;
        await repo.save(repo.create({
            channelId,
            customerId: customer.id as number,
            taskCode,
            type: task.type,
            repeatability: task.repeatability,
            period,
            points,
            growth,
        }));
        await this.credit(ctx, customer.id, points, growth, `task:${taskCode}`);
        return { success: true, points, growth };
    }

    /** 订单 Delivered 事件 → 计算该顾客累计单数/消费额 → 命中里程碑自动发奖（ONCE 幂等）。 */
    async awardMilestones(ctx: RequestContext, customerId: ID): Promise<void> {
        const channelId = ctx.channelId as number;
        const customerIdNum = customerId as number;
        const orderRepo = this.connection.getRepository(ctx, Order);
        const orders = await orderRepo.find({ where: { customerId: customerIdNum } as any });
        const fulfilled = orders.filter(o => MILESTONE_OK_STATES.includes(o.state));
        const count = fulfilled.length;
        const total = fulfilled.reduce((s, o) => s + (o.totalWithTax ?? 0), 0);

        const r = this.rewardMap(ctx);
        const defs = [
            { code: 'first_order', met: count >= 1, points: r.taskFirstOrderPoints, growth: r.taskFirstOrderGrowth },
            { code: 'order_count', met: count >= r.taskOrderCountThreshold, points: r.taskOrderCountPoints, growth: r.taskOrderCountGrowth },
            { code: 'order_amount', met: total >= r.taskOrderAmountThreshold, points: r.taskOrderAmountPoints, growth: r.taskOrderAmountGrowth },
        ];

        const taskRepo = this.connection.getRepository(ctx, TaskRecord);
        for (const def of defs) {
            if (!def.met) continue;
            const existing = await taskRepo.findOne({
                where: { customerId: customerIdNum, taskCode: def.code, channelId, period: null } as any,
            });
            if (existing) continue;
            await taskRepo.save(taskRepo.create({
                channelId,
                customerId: customerIdNum,
                taskCode: def.code,
                type: 'MILESTONE',
                repeatability: 'ONCE',
                period: null,
                points: def.points,
                growth: def.growth,
            }));
            await this.credit(ctx, customerId, def.points, def.growth, `task:${def.code}`);
        }
    }

    /** 我的任务列表（主动任务 + reach_level + 里程碑），返回状态。 */
    async myTasks(ctx: RequestContext): Promise<TaskSummary[]> {
        const customer = await this.requireCustomer(ctx);
        const customerIdNum = customer.id as number;
        const channelId = ctx.channelId as number;
        const r = this.rewardMap(ctx);
        const today = this.localDateStr();
        const recordRepo = this.connection.getRepository(ctx, TaskRecord);
        const records = await recordRepo.find({ where: { customerId: customerIdNum, channelId } as any });
        const claimed = (code: string, period: string | null) =>
            records.some(x => x.taskCode === code && (period == null || x.period === period));

        const out: TaskSummary[] = [];
        const push = (code: string, isClaimed: boolean, met: boolean, points: number, growth: number) => {
            out.push({ taskCode: code, state: isClaimed ? 'claimed' : met ? 'available' : 'not_met', points, growth });
        };

        for (const t of ACTIVE_TASKS) {
            const period = t.repeatability === 'DAILY' ? today : null;
            const met = t.preMet ? t.preMet(ctx, customer) : true;
            push(t.code, claimed(t.code, period), met, r[t.pointsKey] ?? 0, r[t.growthKey] ?? 0);
        }

        const level = (customer as any).customFields?.memberLevel ?? 1;
        push('reach_level', claimed('reach_level', null), level >= r.taskReachLevelThreshold, r.taskReachLevelPoints ?? 0, r.taskReachLevelGrowth ?? 0);

        const orders = await this.connection.getRepository(ctx, Order).find({ where: { customerId: customerIdNum } as any });
        const fulfilled = orders.filter(o => MILESTONE_OK_STATES.includes(o.state));
        push('first_order', claimed('first_order', null), fulfilled.length >= 1, r.taskFirstOrderPoints ?? 0, r.taskFirstOrderGrowth ?? 0);
        push('order_count', claimed('order_count', null), fulfilled.length >= r.taskOrderCountThreshold, r.taskOrderCountPoints ?? 0, r.taskOrderCountGrowth ?? 0);
        push('order_amount', claimed('order_amount', null), fulfilled.reduce((s, o) => s + (o.totalWithTax ?? 0), 0) >= r.taskOrderAmountThreshold, r.taskOrderAmountPoints ?? 0, r.taskOrderAmountGrowth ?? 0);

        return out;
    }
}
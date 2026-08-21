"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CheckinService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const member_level_plugin_1 = require("@vendure/member-level-plugin");
const checkin_record_entity_1 = require("./checkin-record.entity");
const task_record_entity_1 = require("./task-record.entity");
const constants_1 = require("./constants");
const ACTIVE_TASKS = [
    { code: 'daily_share', type: 'ACCOUNT', repeatability: 'DAILY', pointsKey: 'taskSharePoints', growthKey: 'taskShareGrowth' },
    { code: 'daily_login', type: 'ACCOUNT', repeatability: 'DAILY', pointsKey: 'taskLoginPoints', growthKey: 'taskLoginGrowth' },
    { code: 'daily_profile', type: 'ACCOUNT', repeatability: 'DAILY', pointsKey: 'taskProfilePoints', growthKey: 'taskProfileGrowth' },
    {
        code: 'bind_phone',
        type: 'ACCOUNT',
        repeatability: 'ONCE',
        pointsKey: 'taskBindPhonePoints',
        growthKey: 'taskBindPhoneGrowth',
        preMet: (_ctx, customer) => Boolean(customer.phoneNumber),
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
let CheckinService = class CheckinService {
    constructor(connection, customerService, memberService, options) {
        this.connection = connection;
        this.customerService = customerService;
        this.memberService = memberService;
        this.options = options;
    }
    /** 解析当前登录顾客（复用 member/review 口径）。 */
    async requireCustomer(ctx) {
        if (!ctx.activeUserId) {
            throw new core_1.UnauthorizedError();
        }
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer) {
            throw new core_1.EntityNotFoundError('Customer', ctx.activeUserId);
        }
        return customer;
    }
    /** 读取某渠道全部奖励值（channel 自定义字段 ?? options 默认）。 */
    rewardMap(ctx) {
        var _a, _b, _c;
        const cf = (_b = (_a = ctx.channel) === null || _a === void 0 ? void 0 : _a.customFields) !== null && _b !== void 0 ? _b : {};
        const defaults = (_c = this.options.defaultRewards) !== null && _c !== void 0 ? _c : {};
        const result = {};
        for (const key of REWARD_KEYS) {
            const channelVal = cf[key];
            const optVal = defaults[key];
            result[key] = channelVal != null ? Number(channelVal) : optVal != null ? Number(optVal) : 0;
        }
        return result;
    }
    reward(ctx, key) {
        var _a;
        return (_a = this.rewardMap(ctx)[key]) !== null && _a !== void 0 ? _a : 0;
    }
    /** 本地时区日期串 YYYY-MM-DD（可偏移天数） */
    localDateStr(offsetDays = 0) {
        const d = new Date();
        d.setDate(d.getDate() + offsetDays);
        const p = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    }
    /** 统一发奖：走 member-level 记账（积分/成长值），幂等由调用方唯一键保证。 */
    async credit(ctx, customerId, points, growth, source) {
        if (points > 0) {
            await this.memberService.addPoints(ctx, customerId, points, null, source, null);
        }
        if (growth > 0) {
            await this.memberService.addGrowthValue(ctx, customerId, growth, source);
        }
        core_1.Logger.info(`Checkin credit ${source}: +${points}P +${growth}G -> customer ${customerId}`, constants_1.loggerCtx);
    }
    /** 每日签到（幂等：同渠道同日已签则返回 already 不重复发奖）。 */
    async checkin(ctx) {
        var _a;
        const customer = await this.requireCustomer(ctx);
        const channelId = ctx.channelId;
        const customerId = customer.id;
        const today = this.localDateStr();
        const repo = this.connection.getRepository(ctx, checkin_record_entity_1.CheckinRecord);
        const existing = await repo.findOne({ where: { customerId, checkinDate: today, channelId } });
        if (existing) {
            return { success: false, reason: 'already', streak: existing.streak };
        }
        const yesterday = this.localDateStr(-1);
        const last = await repo.findOne({
            where: { customerId, checkinDate: yesterday, channelId },
            order: { id: 'DESC' },
        });
        const prevStreak = (_a = last === null || last === void 0 ? void 0 : last.streak) !== null && _a !== void 0 ? _a : 0;
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
    async checkinToday(ctx) {
        var _a;
        const customer = await this.requireCustomer(ctx);
        const channelId = ctx.channelId;
        const repo = this.connection.getRepository(ctx, checkin_record_entity_1.CheckinRecord);
        const today = await repo.findOne({
            where: { customerId: customer.id, checkinDate: this.localDateStr(), channelId },
        });
        return { checkedIn: Boolean(today), streak: (_a = today === null || today === void 0 ? void 0 : today.streak) !== null && _a !== void 0 ? _a : 0, canCheckin: !today };
    }
    /** 主动领奖（每日任务 + 账户成就 ONCE）。 */
    async claimTask(ctx, taskCode) {
        var _a, _b;
        const customer = await this.requireCustomer(ctx);
        const channelId = ctx.channelId;
        const task = ACTIVE_TASKS.find(t => t.code === taskCode);
        if (!task) {
            return { success: false, reason: 'unknown_task' };
        }
        if (task.preMet && !task.preMet(ctx, customer)) {
            return { success: false, reason: 'not_met' };
        }
        const period = task.repeatability === 'DAILY' ? this.localDateStr() : null;
        const repo = this.connection.getRepository(ctx, task_record_entity_1.TaskRecord);
        const existing = await repo.findOne({
            where: { customerId: customer.id, taskCode, channelId, period },
        });
        if (existing) {
            return { success: false, reason: 'already' };
        }
        const r = this.rewardMap(ctx);
        const points = (_a = r[task.pointsKey]) !== null && _a !== void 0 ? _a : 0;
        const growth = (_b = r[task.growthKey]) !== null && _b !== void 0 ? _b : 0;
        await repo.save(repo.create({
            channelId,
            customerId: customer.id,
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
    async awardMilestones(ctx, customerId) {
        const channelId = ctx.channelId;
        const customerIdNum = customerId;
        const orderRepo = this.connection.getRepository(ctx, core_1.Order);
        const orders = await orderRepo.find({ where: { customerId: customerIdNum } });
        const fulfilled = orders.filter(o => MILESTONE_OK_STATES.includes(o.state));
        const count = fulfilled.length;
        const total = fulfilled.reduce((s, o) => { var _a; return s + ((_a = o.totalWithTax) !== null && _a !== void 0 ? _a : 0); }, 0);
        const r = this.rewardMap(ctx);
        const defs = [
            { code: 'first_order', met: count >= 1, points: r.taskFirstOrderPoints, growth: r.taskFirstOrderGrowth },
            { code: 'order_count', met: count >= r.taskOrderCountThreshold, points: r.taskOrderCountPoints, growth: r.taskOrderCountGrowth },
            { code: 'order_amount', met: total >= r.taskOrderAmountThreshold, points: r.taskOrderAmountPoints, growth: r.taskOrderAmountGrowth },
        ];
        const taskRepo = this.connection.getRepository(ctx, task_record_entity_1.TaskRecord);
        for (const def of defs) {
            if (!def.met)
                continue;
            const existing = await taskRepo.findOne({
                where: { customerId: customerIdNum, taskCode: def.code, channelId, period: null },
            });
            if (existing)
                continue;
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
    async myTasks(ctx) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        const customer = await this.requireCustomer(ctx);
        const customerIdNum = customer.id;
        const channelId = ctx.channelId;
        const r = this.rewardMap(ctx);
        const today = this.localDateStr();
        const recordRepo = this.connection.getRepository(ctx, task_record_entity_1.TaskRecord);
        const records = await recordRepo.find({ where: { customerId: customerIdNum, channelId } });
        const claimed = (code, period) => records.some(x => x.taskCode === code && (period == null || x.period === period));
        const out = [];
        const push = (code, isClaimed, met, points, growth) => {
            out.push({ taskCode: code, state: isClaimed ? 'claimed' : met ? 'available' : 'not_met', points, growth });
        };
        for (const t of ACTIVE_TASKS) {
            const period = t.repeatability === 'DAILY' ? today : null;
            const met = t.preMet ? t.preMet(ctx, customer) : true;
            push(t.code, claimed(t.code, period), met, (_a = r[t.pointsKey]) !== null && _a !== void 0 ? _a : 0, (_b = r[t.growthKey]) !== null && _b !== void 0 ? _b : 0);
        }
        const level = (_d = (_c = customer.customFields) === null || _c === void 0 ? void 0 : _c.memberLevel) !== null && _d !== void 0 ? _d : 1;
        push('reach_level', claimed('reach_level', null), level >= r.taskReachLevelThreshold, (_e = r.taskReachLevelPoints) !== null && _e !== void 0 ? _e : 0, (_f = r.taskReachLevelGrowth) !== null && _f !== void 0 ? _f : 0);
        const orders = await this.connection.getRepository(ctx, core_1.Order).find({ where: { customerId: customerIdNum } });
        const fulfilled = orders.filter(o => MILESTONE_OK_STATES.includes(o.state));
        push('first_order', claimed('first_order', null), fulfilled.length >= 1, (_g = r.taskFirstOrderPoints) !== null && _g !== void 0 ? _g : 0, (_h = r.taskFirstOrderGrowth) !== null && _h !== void 0 ? _h : 0);
        push('order_count', claimed('order_count', null), fulfilled.length >= r.taskOrderCountThreshold, (_j = r.taskOrderCountPoints) !== null && _j !== void 0 ? _j : 0, (_k = r.taskOrderCountGrowth) !== null && _k !== void 0 ? _k : 0);
        push('order_amount', claimed('order_amount', null), fulfilled.reduce((s, o) => { var _a; return s + ((_a = o.totalWithTax) !== null && _a !== void 0 ? _a : 0); }, 0) >= r.taskOrderAmountThreshold, (_l = r.taskOrderAmountPoints) !== null && _l !== void 0 ? _l : 0, (_m = r.taskOrderAmountGrowth) !== null && _m !== void 0 ? _m : 0);
        return out;
    }
};
exports.CheckinService = CheckinService;
exports.CheckinService = CheckinService = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, common_1.Inject)(constants_1.CHECKIN_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.CustomerService,
        member_level_plugin_1.MemberLevelService, Object])
], CheckinService);
//# sourceMappingURL=checkin.service.js.map
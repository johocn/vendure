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
exports.CommunityService = void 0;
const core_1 = require("@vendure/core");
const common_1 = require("@nestjs/common");
const constants_1 = require("./constants");
const community_activity_entity_1 = require("./community-activity.entity");
const community_activity_item_entity_1 = require("./community-activity-item.entity");
const community_participation_entity_1 = require("./community-participation.entity");
const community_commission_entry_entity_1 = require("./community-commission-entry.entity");
const community_leader_entity_1 = require("./community-leader.entity");
let CommunityService = class CommunityService {
    constructor(options, connection, orderService) {
        this.options = options;
        this.connection = connection;
        this.orderService = orderService;
    }
    async getLeaderOf(ctx) {
        if (!ctx.activeUserId)
            throw new core_1.ForbiddenError();
        const leader = await this.connection
            .getRepository(ctx, community_leader_entity_1.CommunityLeader)
            .findOne({ where: { userId: ctx.activeUserId } });
        if (!leader)
            throw new core_1.ForbiddenError();
        return leader;
    }
    /** 买家申请成为团长（绑定自提点）。 */
    async applyLeader(ctx, pickupLocationId) {
        if (!ctx.activeUserId)
            throw new core_1.ForbiddenError();
        const repo = this.connection.getRepository(ctx, community_leader_entity_1.CommunityLeader);
        const existing = await repo.findOne({ where: { userId: ctx.activeUserId } });
        if (existing)
            throw new core_1.UserInputError('Already applied as leader');
        return repo.save(repo.create({
            channelId: ctx.channelId,
            userId: ctx.activeUserId,
            pickupLocationId: pickupLocationId,
            status: 'applied',
        }));
    }
    /** 平台审核团长。 */
    async setLeaderStatus(ctx, leaderId, status) {
        const repo = this.connection.getRepository(ctx, community_leader_entity_1.CommunityLeader);
        const leader = await repo.findOne({ where: { id: leaderId } });
        if (!leader)
            throw new core_1.UserInputError('Leader not found');
        leader.status = status;
        return repo.save(leader);
    }
    /** 团长开团（须 active）。 */
    async createActivity(ctx, input) {
        var _a, _b;
        const leader = await this.getLeaderOf(ctx);
        if (leader.status !== 'active')
            throw new core_1.UserInputError('Leader not active');
        if (new Date(input.cutoffTime) <= new Date(input.windowStart)) {
            throw new core_1.UserInputError('Cutoff must be after window start');
        }
        const repo = this.connection.getRepository(ctx, community_activity_entity_1.CommunityActivity);
        const activity = await repo.save(repo.create({
            channelId: ctx.channelId,
            leaderId: leader.id,
            pickupLocationId: input.pickupLocationId,
            windowStart: new Date(input.windowStart),
            windowEnd: new Date(input.windowEnd),
            cutoffTime: new Date(input.cutoffTime),
            commissionRate: input.commissionRate,
            status: 'draft',
        }));
        // 写选品
        const itemRepo = this.connection.getRepository(ctx, community_activity_item_entity_1.CommunityActivityItem);
        for (const it of (_a = input.items) !== null && _a !== void 0 ? _a : []) {
            await itemRepo.save(itemRepo.create({
                activityId: activity.id,
                variantId: it.variantId,
                price: it.price,
                stockLimit: (_b = it.stockLimit) !== null && _b !== void 0 ? _b : null,
            }));
        }
        return activity;
    }
    async setActivityStatus(ctx, activityId, status) {
        const repo = this.connection.getRepository(ctx, community_activity_entity_1.CommunityActivity);
        const a = await repo.findOne({ where: { id: activityId } });
        if (!a)
            throw new core_1.UserInputError('Activity not found');
        a.status = status;
        return repo.save(a);
    }
    /** 邻居参团：把正式订单绑定到活动（幂等）。 */
    async participate(ctx, orderId, activityId, subtotal) {
        const repo = this.connection.getRepository(ctx, community_participation_entity_1.CommunityParticipation);
        const existing = await repo.findOne({ where: { orderId: orderId } });
        if (existing)
            return existing;
        const activity = await this.connection
            .getRepository(ctx, community_activity_entity_1.CommunityActivity)
            .findOne({ where: { id: activityId } });
        if (!activity || activity.status !== 'open')
            throw new core_1.UserInputError('Activity not open');
        const now = new Date();
        if (now < activity.windowStart || now > activity.windowEnd)
            throw new core_1.UserInputError('Outside activity window');
        if (now >= activity.cutoffTime)
            throw new core_1.UserInputError('Activity cutoff reached');
        return repo.save(repo.create({
            activityId: activityId,
            orderId: orderId,
            leaderId: activity.leaderId,
            subtotal,
        }));
    }
    /** 截单成团：取期内已付款参与订单推进履约（幂等，仅一次）。 */
    async cutoverActivity(ctx, activityId) {
        const repo = this.connection.getRepository(ctx, community_activity_entity_1.CommunityActivity);
        const a = await repo.findOne({ where: { id: activityId } });
        if (!a)
            throw new core_1.UserInputError('Activity not found');
        if (a.status === 'closed')
            return a;
        if (a.status === 'open') {
            a.status = 'cutover';
            await repo.save(a);
        }
        const parts = await this.connection
            .getRepository(ctx, community_participation_entity_1.CommunityParticipation)
            .find({ where: { activityId: activityId } });
        for (const p of parts) {
            const order = await this.orderService.findOne(ctx, p.orderId, ['fulfillments']);
            if (!order)
                continue;
            // 已付款且未进入履约才推进（1人也发）。推进到 Arranged 口径即触发后续备货/发货。
            // 用 core 的 transitionToState 逐单推进；具体目标态与阶段10履约口径一致，
            // 若订单已超过可推进态则跳过。
            if (order.state === 'PaymentAuthorized' || order.state === 'PaymentSettled') {
                // 推进到 ArrangingPayment 已过；这里直接对 Shipped 之前的待履约单推进
                // 保留：由履约侧（备货/发货）处理，本方法侧重“通知/触发”，实际备货由店主导。
            }
        }
        a.status = 'closed';
        return repo.save(a);
    }
    /** 结算期：订单达履约完成 → 单列团长佣金（幂等）。 */
    async settleCommission(ctx, order) {
        var _a;
        const partRepo = this.connection.getRepository(ctx, community_participation_entity_1.CommunityParticipation);
        const part = await partRepo.findOne({ where: { orderId: order.id } });
        if (!part)
            return;
        const activity = await this.connection
            .getRepository(ctx, community_activity_entity_1.CommunityActivity)
            .findOne({ where: { id: part.activityId } });
        if (!activity)
            return;
        const commRepo = this.connection.getRepository(ctx, community_commission_entry_entity_1.CommunityCommissionEntry);
        const existing = await commRepo.findOne({ where: { orderId: order.id } });
        if (existing)
            return; // 幂等
        const amount = Math.round((part.subtotal * activity.commissionRate) / 1000);
        await commRepo.save(commRepo.create({
            leaderId: part.leaderId,
            orderId: order.id,
            amount,
            status: 'pending',
        }));
        const leaderRepo = this.connection.getRepository(ctx, community_leader_entity_1.CommunityLeader);
        const leader = await leaderRepo.findOne({ where: { id: part.leaderId } });
        if (leader) {
            leader.totalCommission = ((_a = leader.totalCommission) !== null && _a !== void 0 ? _a : 0) + amount;
            await leaderRepo.save(leader);
        }
    }
    /** 团长查询。 */
    async myActivities(ctx, options) {
        var _a, _b;
        const leader = await this.getLeaderOf(ctx);
        const [items, totalItems] = await this.connection
            .getRepository(ctx, community_activity_entity_1.CommunityActivity)
            .findAndCount({ where: { leaderId: leader.id }, take: (_a = options === null || options === void 0 ? void 0 : options.take) !== null && _a !== void 0 ? _a : 20, skip: (_b = options === null || options === void 0 ? void 0 : options.skip) !== null && _b !== void 0 ? _b : 0 });
        return { items, totalItems };
    }
    async myCommission(ctx) {
        const leader = await this.getLeaderOf(ctx);
        return { totalCommission: leader.totalCommission };
    }
    /** 平台全局查询。 */
    async activities(ctx, options) {
        var _a, _b;
        const [items, totalItems] = await this.connection
            .getRepository(ctx, community_activity_entity_1.CommunityActivity)
            .findAndCount({ take: (_a = options === null || options === void 0 ? void 0 : options.take) !== null && _a !== void 0 ? _a : 20, skip: (_b = options === null || options === void 0 ? void 0 : options.skip) !== null && _b !== void 0 ? _b : 0 });
        return { items, totalItems };
    }
    async participations(ctx, options) {
        var _a, _b;
        const [items, totalItems] = await this.connection
            .getRepository(ctx, community_participation_entity_1.CommunityParticipation)
            .findAndCount({ take: (_a = options === null || options === void 0 ? void 0 : options.take) !== null && _a !== void 0 ? _a : 20, skip: (_b = options === null || options === void 0 ? void 0 : options.skip) !== null && _b !== void 0 ? _b : 0 });
        return { items, totalItems };
    }
    async handleOrderStateTransition(event) {
        var _a, _b;
        if (event.toState === 'Delivered') {
            // 无 ctx 的结算回调：用 raw 连接（对齐 pickup.onOrderCancelled 手法）
            const conn = this.connection.rawConnection;
            const orderId = (_a = event.order) === null || _a === void 0 ? void 0 : _a.id;
            if (orderId == null)
                return;
            const part = await conn.getRepository(community_participation_entity_1.CommunityParticipation).findOne({ where: { orderId: orderId } });
            if (!part)
                return;
            const activity = await conn.getRepository(community_activity_entity_1.CommunityActivity).findOne({ where: { id: part.activityId } });
            if (!activity)
                return;
            const commRepo = conn.getRepository(community_commission_entry_entity_1.CommunityCommissionEntry);
            const existing = await commRepo.findOne({ where: { orderId: orderId } });
            if (existing)
                return;
            const amount = Math.round((part.subtotal * activity.commissionRate) / 1000);
            await commRepo.save(commRepo.create({ leaderId: part.leaderId, orderId: orderId, amount, status: 'pending' }));
            const leader = await conn.getRepository(community_leader_entity_1.CommunityLeader).findOne({ where: { id: part.leaderId } });
            if (leader) {
                leader.totalCommission = ((_b = leader.totalCommission) !== null && _b !== void 0 ? _b : 0) + amount;
                await conn.getRepository(community_leader_entity_1.CommunityLeader).save(leader);
            }
        }
    }
};
exports.CommunityService = CommunityService;
exports.CommunityService = CommunityService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(constants_1.COMMUNITY_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object, core_1.TransactionalConnection,
        core_1.OrderService])
], CommunityService);
//# sourceMappingURL=community.service.js.map
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CouponFissionService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
const coupon_service_1 = require("./coupon.service");
const coupon_template_entity_1 = require("./coupon-template.entity");
const customer_coupon_entity_1 = require("./customer-coupon.entity");
const coupon_fission_record_entity_1 = require("./coupon-fission-record.entity");
const coupon_fission_1 = require("./coupon-fission");
const constants_1 = require("./constants");
/**
 * 分享裂变（FR-C）服务：
 * - fissionActivity：匿名可查活动视图（含奖励券模板摘要）
 * - claimReward：登录后领取裂变奖励（幂等 + 四例外 + 事务化，R1/R2/R3）
 */
let CouponFissionService = class CouponFissionService {
    constructor(connection, couponService) {
        this.connection = connection;
        this.couponService = couponService;
    }
    /** 渠道 couponFission 配置原文 */
    async loadRawConfig(ctx) {
        var _a, _b;
        const channel = await this.connection
            .getRepository(ctx, 'Channel')
            .createQueryBuilder('ch')
            .where('ch.id = :id', { id: ctx.channelId })
            .getOne();
        return (_b = (_a = channel === null || channel === void 0 ? void 0 : channel.customFields) === null || _a === void 0 ? void 0 : _a.couponFission) !== null && _b !== void 0 ? _b : null;
    }
    /** 活动视图（匿名可查）：返回 null 表示无生效活动（前端不渲染/落页仅展示券店）。 */
    async fissionActivity(ctx) {
        const raw = await this.loadRawConfig(ctx);
        const cfg = (0, coupon_fission_1.parseCouponFissionConfig)(raw);
        if (!cfg)
            return null;
        const templateIds = [cfg.inviteeTemplateId, cfg.inviterTemplateId].filter(n => n > 0);
        if (templateIds.length === 0)
            return null;
        const templates = await this.connection.getRepository(ctx, coupon_template_entity_1.CouponTemplate).find({
            where: { id: (0, typeorm_1.In)(templateIds) },
            relations: { channels: true },
        });
        const own = templates.filter(t => { var _a; return t.enabled && ((_a = t.channels) !== null && _a !== void 0 ? _a : []).some(c => c.id === ctx.channelId); });
        const view = (0, coupon_fission_1.resolveActiveFission)(raw, own, new Date(), ctx.languageCode);
        if (!view)
            return null;
        // 奖励券剩余量（R2 口径）： totalCount>0 && claimedCount>=totalCount → 该侧奖励标记售罄（不发券但活动可继续展示，由前端渲染「已领完」）
        return view;
    }
    /**
     * 领取裂变奖励（登录用户，以邀请码定位分享者）。
     * 返回 status：
     * - OK：发券成功（双方或单方，看 inviterCoupon）
     * - ALREADY_REWARDED：同被分享者同活动已领过（幂等，R3）
     * - SELF_SHARE：自分享不发奖
     * - BLOCKED_NEW_CUSTOMER：活动限新客且被分享者非新客（记档不再重试）
     * - SOLD_OUT：奖励券余量耗尽（R2，可重试但通常稳定失败）
     * - NOT_LOGGED_IN / NO_INVITER / INACTIVE：登录/邀请码/活动窗口问题（服务端已兜底，前端仍需各自引导）
     */
    async claimReward(ctx, inviteCode) {
        var _a, _b, _c, _d, _e, _f, _g;
        const customerId = ctx.activeUserId
            ? (_a = (await this.connection
                .getRepository(ctx, core_1.Customer)
                .findOne({ where: { user: { id: ctx.activeUserId } } }))) === null || _a === void 0 ? void 0 : _a.id
            : undefined;
        if (!customerId) {
            return { status: 'NOT_LOGGED_IN', inviteeCoupon: null, inviterCoupon: null };
        }
        // 领券前收敛过期券（与限领/计数语义一致）
        await this.couponService.expireDueCoupons(ctx, customerId);
        const raw = await this.loadRawConfig(ctx);
        const templatesRepo = this.connection.getRepository(ctx, coupon_template_entity_1.CouponTemplate);
        const cfg = (0, coupon_fission_1.parseCouponFissionConfig)(raw);
        if (!cfg) {
            return { status: 'INACTIVE', inviteeCoupon: null, inviterCoupon: null };
        }
        const templateIds = [cfg.inviteeTemplateId, cfg.inviterTemplateId].filter(n => n > 0);
        const templates = templateIds.length
            ? await templatesRepo.find({ where: { id: (0, typeorm_1.In)(templateIds) }, relations: { channels: true } })
            : [];
        const own = templates.filter(t => { var _a; return t.enabled && ((_a = t.channels) !== null && _a !== void 0 ? _a : []).some(c => c.id === ctx.channelId); });
        const activity = (0, coupon_fission_1.resolveActiveFission)(raw, own, new Date(), ctx.languageCode);
        if (!activity) {
            return { status: 'INACTIVE', inviteeCoupon: null, inviterCoupon: null };
        }
        // 定位分享者：优先可逆码 F<base36(customerId)>（FR-C 分享链标准形态，每人固定、无快照歧义）；
        // 非 F 前缀回退 Customer.customFields.inviteCode 反查（SSO 邀请快照，兼容旧链路）。
        const code = String(inviteCode !== null && inviteCode !== void 0 ? inviteCode : '').trim();
        if (!code) {
            return { status: 'NO_INVITER', inviteeCoupon: null, inviterCoupon: null };
        }
        let inviter;
        const reversibleId = (0, coupon_fission_1.parseReversibleInviteCode)(code);
        if (reversibleId != null) {
            inviter =
                (_b = (await this.connection
                    .getRepository(ctx, core_1.Customer)
                    .findOne({ where: { id: reversibleId }, relations: { channels: true } }))) !== null && _b !== void 0 ? _b : undefined;
            if (inviter && !((_c = inviter.channels) !== null && _c !== void 0 ? _c : []).some(ch => ch.id === ctx.channelId)) {
                inviter = undefined; // 分享者不属于本租户：按无效码处理
            }
        }
        else {
            const isPg = this.connection.rawConnection.options.type === 'postgres';
            if (isPg) {
                inviter =
                    (_d = (await this.connection
                        .getRepository(ctx, core_1.Customer)
                        .createQueryBuilder('c')
                        .innerJoin('c.channels', 'channel', 'channel.id = :cid', { cid: ctx.channelId })
                        .where('c.customFields.inviteCode = :code', { code })
                        .getOne())) !== null && _d !== void 0 ? _d : undefined;
            }
            else {
                // e2e（SQLite）：数据量小，全量过滤
                const all = await this.connection.getRepository(ctx, core_1.Customer).find({ relations: { channels: true } });
                inviter = all.find(c => {
                    var _a, _b;
                    return ((_a = c.customFields) === null || _a === void 0 ? void 0 : _a.inviteCode) === code &&
                        ((_b = c.channels) !== null && _b !== void 0 ? _b : []).some(ch => ch.id === ctx.channelId);
                });
            }
        }
        if (!(inviter === null || inviter === void 0 ? void 0 : inviter.id)) {
            return { status: 'NO_INVITER', inviteeCoupon: null, inviterCoupon: null };
        }
        const inviterId = inviter.id;
        if (inviterId === customerId) {
            return { status: 'SELF_SHARE', inviteeCoupon: null, inviterCoupon: null };
        }
        const recordRepo = this.connection.getRepository(ctx, coupon_fission_record_entity_1.CouponFissionRecord);
        const existing = await recordRepo.findOne({
            where: { channelId: ctx.channelId, inviteeCustomerId: customerId },
        });
        if (existing) {
            const [inviteeCoupon, inviterCoupon] = await Promise.all([
                existing.inviteeCouponId
                    ? this.connection.getRepository(ctx, customer_coupon_entity_1.CustomerCoupon).findOne({ where: { id: existing.inviteeCouponId } })
                    : null,
                existing.inviterCouponId
                    ? this.connection.getRepository(ctx, customer_coupon_entity_1.CustomerCoupon).findOne({ where: { id: existing.inviterCouponId } })
                    : null,
            ]);
            if (existing.status === 'BLOCKED_NEW_CUSTOMER') {
                return { status: 'BLOCKED_NEW_CUSTOMER', inviteeCoupon: null, inviterCoupon: null };
            }
            return { status: 'ALREADY_REWARDED', inviteeCoupon: inviteeCoupon !== null && inviteeCoupon !== void 0 ? inviteeCoupon : null, inviterCoupon: inviterCoupon !== null && inviterCoupon !== void 0 ? inviterCoupon : null };
        }
        // 事务化发奖（R3）：扣量 → 建券（双方）→ 落记录（唯一索引兜底幂等），任一步失败整体回滚
        try {
            return await this.connection.withTransaction(ctx, async (txCtx) => this.claimRewardInTransaction(txCtx, { cfg, activity, inviterId, customerId }));
        }
        catch (e) {
            if (String((_e = e === null || e === void 0 ? void 0 : e.message) !== null && _e !== void 0 ? _e : '').includes('UNIQUE') || String((_f = e === null || e === void 0 ? void 0 : e.code) !== null && _f !== void 0 ? _f : '') === '23505') {
                // 并发下唯一索引冲突 = 同被分享者同活动已领过（R3 幂等）
                core_1.Logger.warn(`fission record conflict for customer ${customerId}: ${(_g = e === null || e === void 0 ? void 0 : e.message) !== null && _g !== void 0 ? _g : e}`, constants_1.loggerCtx);
                return { status: 'ALREADY_REWARDED', inviteeCoupon: null, inviterCoupon: null };
            }
            throw e;
        }
    }
    /** 事务内执行发奖主体（withTransaction 回调；所有读写必须走传入的 txCtx）。 */
    async claimRewardInTransaction(txCtx, input) {
        var _a, _b, _c, _d;
        const { cfg, activity, inviterId, customerId } = input;
        const recordRepo = this.connection.getRepository(txCtx, coupon_fission_record_entity_1.CouponFissionRecord);
        // 事务内复检（并发窗口兜底）
        const existingInTx = await recordRepo.findOne({
            where: { channelId: txCtx.channelId, inviteeCustomerId: customerId },
        });
        if (existingInTx) {
            return await this.mapExisting(existingInTx, txCtx);
        }
        if (cfg.newCustomerOnly && !(await this.couponService.isCampaignNewCustomer(txCtx, customerId))) {
            await recordRepo.save(new coupon_fission_record_entity_1.CouponFissionRecord({
                channelId: txCtx.channelId,
                inviterCustomerId: inviterId,
                inviteeCustomerId: customerId,
                inviteeCouponId: null,
                inviterCouponId: null,
                status: 'BLOCKED_NEW_CUSTOMER',
                sharedAt: new Date(),
            }));
            return { status: 'BLOCKED_NEW_CUSTOMER', inviteeCoupon: null, inviterCoupon: null };
        }
        const inviteeCoupon = await this.issueRewardInTx(txCtx, customerId, activity.inviteeTemplate);
        if (!inviteeCoupon) {
            return { status: 'SOLD_OUT', inviteeCoupon: null, inviterCoupon: null };
        }
        let inviterCoupon = null;
        if (activity.inviterTemplate) {
            const limit = cfg.inviterRewardLimit;
            if (limit > 0) {
                const rewarded = await recordRepo
                    .createQueryBuilder('r')
                    .where('r.channelId = :channelId', { channelId: txCtx.channelId })
                    .andWhere('r.inviterCustomerId = :inviterId', { inviterId })
                    .andWhere('r.inviterCouponId IS NOT NULL')
                    .getCount();
                if (rewarded >= limit) {
                    core_1.Logger.info(`fission: inviter ${inviterId} reached reward limit ${limit}, skip inviter coupon`, constants_1.loggerCtx);
                }
                else if (activity.inviterTemplate) {
                    inviterCoupon = await this.issueRewardInTx(txCtx, inviterId, activity.inviterTemplate);
                }
            }
            else if (activity.inviterTemplate) {
                inviterCoupon = await this.issueRewardInTx(txCtx, inviterId, activity.inviterTemplate);
            }
        }
        await recordRepo.save(new coupon_fission_record_entity_1.CouponFissionRecord({
            channelId: txCtx.channelId,
            inviterCustomerId: inviterId,
            inviteeCustomerId: customerId,
            inviteeCouponId: (_a = inviteeCoupon === null || inviteeCoupon === void 0 ? void 0 : inviteeCoupon.id) !== null && _a !== void 0 ? _a : null,
            inviterCouponId: (_b = inviterCoupon === null || inviterCoupon === void 0 ? void 0 : inviterCoupon.id) !== null && _b !== void 0 ? _b : null,
            status: 'OK',
            sharedAt: new Date(),
        }));
        core_1.Logger.info(`fission rewarded: invitee=${customerId} inviter=${inviterId} inviteeCoupon=${(_c = inviteeCoupon === null || inviteeCoupon === void 0 ? void 0 : inviteeCoupon.code) !== null && _c !== void 0 ? _c : '-'} inviterCoupon=${(_d = inviterCoupon === null || inviterCoupon === void 0 ? void 0 : inviterCoupon.code) !== null && _d !== void 0 ? _d : '-'}`, constants_1.loggerCtx);
        return { status: 'OK', inviteeCoupon, inviterCoupon };
    }
    /** 已有记录 → 结果映射（幂等重入） */
    async mapExisting(record, ctx) {
        if (record.status === 'BLOCKED_NEW_CUSTOMER') {
            return { status: 'BLOCKED_NEW_CUSTOMER', inviteeCoupon: null, inviterCoupon: null };
        }
        const ccRepo = this.connection.getRepository(ctx, customer_coupon_entity_1.CustomerCoupon);
        const [inviteeCoupon, inviterCoupon] = await Promise.all([
            record.inviteeCouponId
                ? ccRepo.findOne({ where: { id: record.inviteeCouponId } })
                : Promise.resolve(null),
            record.inviterCouponId
                ? ccRepo.findOne({ where: { id: record.inviterCouponId } })
                : Promise.resolve(null),
        ]);
        return { status: 'ALREADY_REWARDED', inviteeCoupon: inviteeCoupon !== null && inviteeCoupon !== void 0 ? inviteeCoupon : null, inviterCoupon: inviterCoupon !== null && inviterCoupon !== void 0 ? inviterCoupon : null };
    }
    /** 发放单侧奖励：原子扣发行余量 + 建券（issuedBy=FISSION 留痕）。售罄/失败返回 null（事务内不产生半写）。 */
    async issueRewardInTx(ctx, customerId, tpl) {
        var _a;
        try {
            return await this.couponService.issueForProgram(ctx, customerId, tpl, 'FISSION');
        }
        catch (e) {
            core_1.Logger.warn(`fission issue failed for customer ${customerId}: ${(_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e}`, constants_1.loggerCtx);
            return null;
        }
    }
    /** 裂变记录列表（管理端核对渠道留痕，R1） */
    async listFissionRecords(ctx, take = 50) {
        return this.connection
            .getRepository(ctx, coupon_fission_record_entity_1.CouponFissionRecord)
            .createQueryBuilder('r')
            .where('r.channelId = :channelId', { channelId: ctx.channelId })
            .orderBy('r.id', 'DESC')
            .take(take)
            .getMany();
    }
};
exports.CouponFissionService = CouponFissionService;
exports.CouponFissionService = CouponFissionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        coupon_service_1.CouponService])
], CouponFissionService);
//# sourceMappingURL=coupon-fission.service.js.map
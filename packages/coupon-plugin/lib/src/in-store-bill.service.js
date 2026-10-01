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
exports.InStoreBillService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const coupon_service_1 = require("./coupon.service");
const customer_coupon_entity_1 = require("./customer-coupon.entity");
const in_store_bill_entity_1 = require("./in-store-bill.entity");
const in_store_bill_1 = require("./in-store-bill");
const localize_1 = require("./localize");
let InStoreBillService = class InStoreBillService {
    constructor(connection, couponService) {
        this.connection = connection;
        this.couponService = couponService;
    }
    /**
     * 券码 → 可用到店买单券（校验顺序见 spec §7）：
     * 存在 → 模板启用 → 未使用 → 未过期 → 场景含 IN_STORE → 渠道归属 → 属店权限。
     * 失败不抛错，返回原因码（quote 用；redeem 再转为 UserInputError）。
     */
    async locate(ctx, code) {
        var _a;
        const trimmed = (code !== null && code !== void 0 ? code : '').trim();
        if (!trimmed) {
            return { ok: false, reason: in_store_bill_1.IN_STORE_REASON.COUPON_NOT_FOUND };
        }
        const cc = await this.connection.getRepository(ctx, customer_coupon_entity_1.CustomerCoupon).findOne({
            where: { code: trimmed },
            relations: { template: { channels: true } },
        });
        if (!cc) {
            return { ok: false, reason: in_store_bill_1.IN_STORE_REASON.COUPON_NOT_FOUND };
        }
        const tpl = cc.template;
        if (!tpl || !tpl.enabled) {
            return { ok: false, reason: in_store_bill_1.IN_STORE_REASON.TEMPLATE_DISABLED };
        }
        if (cc.status !== 'UNUSED') {
            return { ok: false, reason: in_store_bill_1.IN_STORE_REASON.COUPON_NOT_UNUSED };
        }
        if (cc.expiredAt && new Date(cc.expiredAt).getTime() <= Date.now()) {
            return { ok: false, reason: in_store_bill_1.IN_STORE_REASON.COUPON_EXPIRED };
        }
        const scene = (_a = tpl.usageScene) !== null && _a !== void 0 ? _a : 'ONLINE';
        if (scene !== 'IN_STORE' && scene !== 'ALL') {
            return { ok: false, reason: in_store_bill_1.IN_STORE_REASON.SCENE_MISMATCH };
        }
        if (!this.couponService.templateBelongsToChannel(ctx, tpl)) {
            return { ok: false, reason: in_store_bill_1.IN_STORE_REASON.TENANT_MISMATCH };
        }
        try {
            await this.couponService.assertManagedByShop(ctx, tpl.shopId);
        }
        catch (_b) {
            return { ok: false, reason: in_store_bill_1.IN_STORE_REASON.TENANT_MISMATCH };
        }
        return { ok: true, cc, tpl };
    }
    /** 核销表单试算：originalAmount 省略 → 仅回券信息；否则回试算金额 */
    async quote(ctx, code, originalAmount) {
        var _a, _b, _c, _d;
        const located = await this.locate(ctx, code);
        if (!located.ok) {
            return { ok: false, reason: located.reason };
        }
        const { cc, tpl } = located;
        const info = await this.loadCustomerInfo(ctx, cc.customerId);
        const base = {
            ok: true,
            reason: null,
            couponCode: cc.code,
            couponName: (0, localize_1.localizeText)(tpl.name, ctx.languageCode),
            discountType: tpl.type,
            discountValue: tpl.discountValue,
            minSpend: (_a = tpl.minSpend) !== null && _a !== void 0 ? _a : 0,
            customerName: (_b = info.name) !== null && _b !== void 0 ? _b : null,
            customerPhone: (_c = info.phone) !== null && _c !== void 0 ? _c : null,
            expiresAt: (_d = cc.expiredAt) !== null && _d !== void 0 ? _d : null,
            originalAmount: null,
            discountAmount: null,
            finalAmount: null,
        };
        if (originalAmount == null) {
            return base;
        }
        const computed = (0, in_store_bill_1.computeInStoreBill)(tpl, originalAmount);
        if (!computed.ok) {
            // 保留券信息，便于页面同时展示券卡与金额校验提示
            return Object.assign(Object.assign({}, base), { ok: false, reason: computed.reason });
        }
        return Object.assign(Object.assign({}, base), { originalAmount: computed.originalAmount, discountAmount: computed.discountAmount, finalAmount: computed.finalAmount });
    }
    /**
     * 到店买单核销：校验 → 原子占用（仅 UNUSED 可置 USED）→ 写流水。
     * 需在 @Transaction() 内调用。
     */
    async redeem(ctx, code, originalAmount, remark) {
        var _a;
        const located = await this.locate(ctx, code);
        if (!located.ok) {
            throw new core_1.UserInputError(in_store_bill_1.IN_STORE_REASON_MESSAGES[located.reason]);
        }
        const { cc, tpl } = located;
        const computed = (0, in_store_bill_1.computeInStoreBill)(tpl, originalAmount);
        if (!computed.ok) {
            throw new core_1.UserInputError(in_store_bill_1.IN_STORE_REASON_MESSAGES[computed.reason]);
        }
        // 并发防护：状态条件更新，affectedRows=0 说明已被其它请求核销
        const consume = await this.connection
            .getRepository(ctx, customer_coupon_entity_1.CustomerCoupon)
            .createQueryBuilder()
            .update()
            .set({ status: 'USED', usedAt: new Date() })
            .where('id = :id AND status = :unused', { id: cc.id, unused: 'UNUSED' })
            .execute();
        if (((_a = consume.affected) !== null && _a !== void 0 ? _a : 0) === 0) {
            throw new core_1.UserInputError(in_store_bill_1.IN_STORE_REASON_MESSAGES[in_store_bill_1.IN_STORE_REASON.COUPON_NOT_UNUSED]);
        }
        const info = await this.loadCustomerInfo(ctx, cc.customerId);
        const operatorName = await this.resolveOperatorName(ctx);
        const bill = new in_store_bill_entity_1.InStoreBill({
            channelId: ctx.channelId,
            customerCouponId: cc.id,
            couponCode: cc.code,
            couponTemplateId: tpl.id,
            couponName: (0, localize_1.localizeText)(tpl.name, ctx.languageCode),
            customerId: cc.customerId,
            customerName: info.name,
            customerPhone: info.phone,
            discountType: tpl.type,
            discountValue: tpl.discountValue,
            originalAmount: computed.originalAmount,
            discountAmount: computed.discountAmount,
            finalAmount: computed.finalAmount,
            operatorId: ctx.activeUserId,
            operatorName,
            remark: (remark === null || remark === void 0 ? void 0 : remark.trim()) || undefined,
            billedAt: new Date(),
        });
        return this.connection.getRepository(ctx, in_store_bill_entity_1.InStoreBill).save(bill);
    }
    /** 流水列表：按当前渠道强制隔离 + 券码/时间筛选 + 时间倒序分页 */
    async list(ctx, options) {
        var _a, _b;
        const qb = this.buildBillsQuery(ctx, options);
        qb.orderBy('b.billedAt', 'DESC').addOrderBy('b.id', 'DESC');
        qb.skip(Math.max(0, (_a = options === null || options === void 0 ? void 0 : options.skip) !== null && _a !== void 0 ? _a : 0)).take(Math.min((_b = options === null || options === void 0 ? void 0 : options.take) !== null && _b !== void 0 ? _b : 20, 200));
        const [items, totalItems] = await qb.getManyAndCount();
        return { items, totalItems };
    }
    /** 流水汇总：笔数 / 原价合计 / 优惠合计 / 实收合计（金额单位：分） */
    async summary(ctx, options) {
        var _a, _b, _c, _d;
        const qb = this.buildBillsQuery(ctx, options);
        const raw = await qb
            .select('COUNT(*)', 'count')
            .addSelect('COALESCE(SUM(b.originalAmount), 0)', 'originalTotal')
            .addSelect('COALESCE(SUM(b.discountAmount), 0)', 'discountTotal')
            .addSelect('COALESCE(SUM(b.finalAmount), 0)', 'finalTotal')
            .getRawOne();
        return {
            count: Number((_a = raw === null || raw === void 0 ? void 0 : raw.count) !== null && _a !== void 0 ? _a : 0),
            originalTotal: Number((_b = raw === null || raw === void 0 ? void 0 : raw.originalTotal) !== null && _b !== void 0 ? _b : 0),
            discountTotal: Number((_c = raw === null || raw === void 0 ? void 0 : raw.discountTotal) !== null && _c !== void 0 ? _c : 0),
            finalTotal: Number((_d = raw === null || raw === void 0 ? void 0 : raw.finalTotal) !== null && _d !== void 0 ? _d : 0),
        };
    }
    /** 流水查询基座：渠道隔离 + 可选筛选（list / summary 共用） */
    buildBillsQuery(ctx, options) {
        const qb = this.connection
            .getRepository(ctx, in_store_bill_entity_1.InStoreBill)
            .createQueryBuilder('b')
            .where('b.channelId = :channelId', { channelId: Number(ctx.channelId) });
        if (options === null || options === void 0 ? void 0 : options.couponCode) {
            qb.andWhere('b.couponCode = :code', { code: options.couponCode.trim() });
        }
        if (options === null || options === void 0 ? void 0 : options.from) {
            qb.andWhere('b.billedAt >= :from', { from: options.from });
        }
        if (options === null || options === void 0 ? void 0 : options.to) {
            qb.andWhere('b.billedAt <= :to', { to: options.to });
        }
        return qb;
    }
    /** 顾客姓名/手机号快照（查询失败不阻断核销） */
    async loadCustomerInfo(ctx, customerId) {
        var _a;
        try {
            const c = await this.connection.getRepository(ctx, core_1.Customer).findOne({
                where: { id: customerId },
            });
            if (!c)
                return {};
            const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || c.emailAddress || undefined;
            return { name, phone: (_a = c.phoneNumber) !== null && _a !== void 0 ? _a : undefined };
        }
        catch (_b) {
            return {};
        }
    }
    /** 核销人名称快照（查询失败不阻断核销） */
    async resolveOperatorName(ctx) {
        try {
            const admin = await this.connection.getRepository(ctx, core_1.Administrator).findOne({
                where: { user: { id: ctx.activeUserId } },
            });
            if (!admin)
                return undefined;
            return [admin.firstName, admin.lastName].filter(Boolean).join(' ') || admin.emailAddress || undefined;
        }
        catch (_a) {
            return undefined;
        }
    }
};
exports.InStoreBillService = InStoreBillService;
exports.InStoreBillService = InStoreBillService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        coupon_service_1.CouponService])
], InStoreBillService);
//# sourceMappingURL=in-store-bill.service.js.map
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
exports.AddressChangeService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const campus_address_change_entity_1 = require("./campus-address-change.entity");
const campus_building_entity_1 = require("./campus-building.entity");
const campus_fulfillment_config_entity_1 = require("./campus-fulfillment-config.entity");
const campus_zone_entity_1 = require("./campus-zone.entity");
const capacity_service_1 = require("./capacity.service");
const shipping_calculator_1 = require("./shipping-calculator");
const dynamic_pricing_1 = require("./dynamic-pricing");
const loggerCtx = 'CampusAddressChange';
/** 外部配送已接单/取货后不可改址 */
const THIRD_PARTY_LOCKED = ['accepted', 'pickup', 'delivered'];
let AddressChangeService = class AddressChangeService {
    constructor(connection, orderService, customerService, capacity) {
        this.connection = connection;
        this.orderService = orderService;
        this.customerService = customerService;
        this.capacity = capacity;
    }
    /** 顾客自助改址（取货前、可跨分区）。差额不阻塞改址，写入台账待运营结算。 */
    async changeByCustomer(ctx, input) {
        var _a, _b;
        if (!ctx.activeUserId)
            throw new core_1.ForbiddenError();
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer)
            throw new core_1.ForbiddenError();
        const order = await this.loadOrder(ctx, input.orderId);
        if (((_a = order.customer) === null || _a === void 0 ? void 0 : _a.id) !== customer.id)
            throw new core_1.ForbiddenError();
        this.assertNotCancelledOrDelivered(order);
        const cf = ((_b = order.customFields) !== null && _b !== void 0 ? _b : {});
        if (cf.deliveryStatus === 'in_progress')
            throw new core_1.UserInputError('骑手已取货，无法自助改址，请联系客服');
        if (THIRD_PARTY_LOCKED.includes(cf.thirdPartyState))
            throw new core_1.UserInputError('外部配送已接单，无法自助改址');
        const { zone, building } = await this.resolveTarget(ctx, input.zoneId, input.buildingId);
        return this.applyChange(ctx, order, zone, building, input.detail, {
            source: 'customer',
            reason: null,
            changedBy: ctx.activeUserId,
            customerId: customer.id,
        });
    }
    /**
     * 运营代客改址：C 端取货后锁死，运营可代改（必须填原因，全程留痕）。
     * 仅「已取消 / 已送达」拒绝；骑手取货、外部已接单均允许代改。
     */
    async adminChange(ctx, input) {
        var _a, _b, _c, _d;
        const reason = ((_a = input.reason) !== null && _a !== void 0 ? _a : '').trim();
        if (!reason)
            throw new core_1.UserInputError('请填写代改原因');
        const order = await this.loadOrder(ctx, input.orderId);
        if (Number(this.channelIdOf(order, ctx)) !== Number(ctx.channelId))
            throw new core_1.ForbiddenError();
        this.assertNotCancelledOrDelivered(order);
        const { zone, building } = await this.resolveTarget(ctx, input.zoneId, input.buildingId);
        return this.applyChange(ctx, order, zone, building, input.detail, {
            source: 'admin',
            reason,
            changedBy: ((_b = ctx.activeUserId) !== null && _b !== void 0 ? _b : null),
            customerId: ((_d = (_c = order.customer) === null || _c === void 0 ? void 0 : _c.id) !== null && _d !== void 0 ? _d : null),
        });
    }
    /** 改址差额试算（运营端预览：不写台账、不改订单） */
    async quote(ctx, orderId, zoneId) {
        var _a, _b;
        const order = await this.loadOrder(ctx, orderId);
        if (Number(this.channelIdOf(order, ctx)) !== Number(ctx.channelId))
            throw new core_1.ForbiddenError();
        this.assertNotCancelledOrDelivered(order);
        const zone = await this.connection.getRepository(ctx, campus_zone_entity_1.CampusZone).findOne({ where: { id: zoneId } });
        if (!zone)
            throw new core_1.UserInputError('分区不存在');
        if (Number(zone.channelId) !== Number(ctx.channelId))
            throw new core_1.ForbiddenError();
        const channelId = this.channelIdOf(order, ctx);
        const cfg = await this.connection.rawConnection.getRepository(campus_fulfillment_config_entity_1.CampusFulfillmentConfig).findOne({
            where: { channelId: channelId },
        });
        const oldFee = Number((_a = order.shippingWithTax) !== null && _a !== void 0 ? _a : 0);
        const q = await (0, shipping_calculator_1.quoteZoneFee)(this.connection, channelId, { name: zone.name, fee: Number(zone.fee) }, cfg, order);
        const newFee = Number((_b = q === null || q === void 0 ? void 0 : q.price) !== null && _b !== void 0 ? _b : oldFee);
        const buildings = await this.connection
            .getRepository(ctx, campus_building_entity_1.CampusBuilding)
            .find({ where: { zoneId: zone.id, channelId: channelId } });
        return {
            oldFee,
            newFee,
            diff: newFee - oldFee,
            zoneId: zone.id,
            zoneName: zone.name,
            buildings,
        };
    }
    /** 顾客端：本单最近一次改址（差额状态感知，含已结清） */
    async myLatest(ctx, orderId) {
        var _a;
        if (!ctx.activeUserId)
            throw new core_1.ForbiddenError();
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer)
            throw new core_1.ForbiddenError();
        const order = await this.loadOrder(ctx, orderId);
        if (((_a = order.customer) === null || _a === void 0 ? void 0 : _a.id) !== customer.id)
            throw new core_1.ForbiddenError();
        const row = await this.connection
            .getRepository(ctx, campus_address_change_entity_1.CampusAddressChange)
            .findOne({ where: { orderId: Number(order.id) }, order: { createdAt: 'DESC' } });
        if (!row)
            return null;
        return {
            id: row.id,
            diff: row.diff,
            status: row.status,
            settleAction: row.settleAction,
            fromZone: row.fromZone,
            fromBuilding: row.fromBuilding,
            toZone: row.toZone,
            toBuilding: row.toBuilding,
            createdAt: row.createdAt,
        };
    }
    /** 动态计价预览：当前供需 + 各分区试算拆解（后台配置页用） */
    async dynamicPreview(ctx) {
        var _a, _b;
        const channelId = ctx.channelId;
        const cfg = await this.connection.rawConnection.getRepository(campus_fulfillment_config_entity_1.CampusFulfillmentConfig).findOne({
            where: { channelId: channelId },
        });
        const pricing = (0, dynamic_pricing_1.parseDynamicPricing)((_a = cfg === null || cfg === void 0 ? void 0 : cfg.dynamicPricing) !== null && _a !== void 0 ? _a : null);
        const zones = (await this.connection.rawConnection.getRepository(campus_zone_entity_1.CampusZone).find({
            where: { channelId: channelId },
            order: { id: 'ASC' },
        }));
        const backlog = pricing.enabled && pricing.supply ? await (0, shipping_calculator_1.readHallBacklog)(this.connection, channelId) : 0;
        const onlineRiders = (await this.capacity.listOnlineRiders(ctx)).length;
        const now = new Date();
        // 非分区口径：R5 跑腿起步价（未配置按默认 200）、R2 第三方到校基价（未配置不接管）
        const quoteBase = (key, raw, fallback) => {
            const base = raw !== null && raw !== void 0 ? raw : fallback;
            if (base == null)
                return null;
            const q = (0, dynamic_pricing_1.quoteDynamicFee)({ baseFee: Number(base), config: pricing, at: now, backlog, onlineRiders });
            return {
                key,
                configured: raw != null,
                baseFee: q.baseFee,
                price: q.price,
                addFee: q.addFee,
                breakdown: q.breakdown,
            };
        };
        return {
            at: now.toISOString(),
            enabled: pricing.enabled,
            backlog,
            onlineRiders,
            manualMultiplier: pricing.manualMultiplier,
            maxAddFee: pricing.maxAddFee,
            errand: quoteBase('errand', cfg === null || cfg === void 0 ? void 0 : cfg.errandBaseFee, 200),
            thirdParty: quoteBase('third-party', cfg === null || cfg === void 0 ? void 0 : cfg.thirdPartyBaseFee, null),
            supply: pricing.supply
                ? {
                    backlogThreshold: pricing.supply.backlogThreshold,
                    riderThreshold: (_b = pricing.supply.riderThreshold) !== null && _b !== void 0 ? _b : null,
                    addFee: pricing.supply.addFee,
                }
                : null,
            peakWindows: pricing.peakWindows,
            zones: zones.map(z => {
                const q = (0, dynamic_pricing_1.quoteDynamicFee)({
                    baseFee: Number(z.fee),
                    config: pricing,
                    at: now,
                    backlog,
                    onlineRiders,
                });
                return {
                    zoneId: z.id,
                    zoneName: z.name,
                    baseFee: q.baseFee,
                    price: q.price,
                    addFee: q.addFee,
                    breakdown: q.breakdown,
                };
            }),
        };
    }
    async list(ctx, opts = {}) {
        var _a, _b;
        const qb = this.connection
            .getRepository(ctx, campus_address_change_entity_1.CampusAddressChange)
            .createQueryBuilder('r')
            .where('r.channelId = :cid', { cid: ctx.channelId })
            .orderBy('r.createdAt', 'DESC')
            .skip((_a = opts.skip) !== null && _a !== void 0 ? _a : 0)
            .take(Math.min((_b = opts.take) !== null && _b !== void 0 ? _b : 50, 200));
        if (opts.status)
            qb.andWhere('r.status = :st', { st: opts.status });
        if (opts.orderId != null)
            qb.andWhere('r.orderId = :oid', { oid: Number(opts.orderId) });
        return qb.getMany();
    }
    async stats(ctx) {
        const rows = await this.connection
            .getRepository(ctx, campus_address_change_entity_1.CampusAddressChange)
            .createQueryBuilder('r')
            .select('r.status', 'status')
            .addSelect('COUNT(*)', 'cnt')
            .addSelect('COALESCE(SUM(CASE WHEN r.diff > 0 THEN r.diff ELSE 0 END), 0)', 'collect')
            .addSelect('COALESCE(SUM(CASE WHEN r.diff < 0 THEN -r.diff ELSE 0 END), 0)', 'refund')
            .where('r.channelId = :cid', { cid: ctx.channelId })
            .groupBy('r.status')
            .getRawMany();
        let pendingCount = 0;
        let pendingCollect = 0;
        let pendingRefund = 0;
        let total = 0;
        for (const r of rows) {
            const cnt = Number(r.cnt) || 0;
            total += cnt;
            if (r.status === 'pending') {
                pendingCount += cnt;
                pendingCollect += Number(r.collect) || 0;
                pendingRefund += Number(r.refund) || 0;
            }
        }
        return {
            total,
            pendingCount,
            pendingCollect,
            pendingRefund,
        };
    }
    /** 运营结清：refund=真实退款 / collect=补收（必须填凭证）/ waive=免收 / pending=撤销结清 */
    async settle(ctx, id, action, note) {
        var _a;
        if (!['refund', 'collect', 'waive', 'pending'].includes(action)) {
            throw new core_1.UserInputError('无效的结清动作');
        }
        const repo = this.connection.getRepository(ctx, campus_address_change_entity_1.CampusAddressChange);
        const row = await repo.findOne({ where: { id: id } });
        if (!row)
            throw new core_1.UserInputError('台账记录不存在');
        if (Number(row.channelId) !== Number(ctx.channelId))
            throw new core_1.ForbiddenError();
        const trimmed = (note !== null && note !== void 0 ? note : '').trim();
        if (action === 'pending') {
            if (row.refundId)
                throw new core_1.UserInputError('该差额已实际退款，无法撤销结清');
            row.status = 'pending';
            row.settledAt = null;
            row.settledBy = null;
            row.settleAction = null;
            row.settleNote = null;
        }
        else {
            if (action === 'refund') {
                if (Number(row.diff) >= 0)
                    throw new core_1.UserInputError('本单不是待退差额，不能按已退款结清');
                if (row.refundId)
                    throw new core_1.UserInputError('该差额已退款，请勿重复操作');
                const amount = Math.abs(Number(row.diff));
                if (amount > 0) {
                    const order = await this.loadOrder(ctx, row.orderId);
                    const refund = await this.refundAmount(ctx, order, amount, `address change refund (${row.orderCode})`);
                    row.refundId = refund.id;
                }
            }
            if (action === 'collect') {
                if (Number(row.diff) <= 0)
                    throw new core_1.UserInputError('本单无待补收差额，无需补收');
                if (!trimmed)
                    throw new core_1.UserInputError('请填写补收凭证（收款方式或流水号）');
            }
            row.status = 'settled';
            row.settledAt = new Date();
            row.settledBy = ((_a = ctx.activeUserId) !== null && _a !== void 0 ? _a : null);
            row.settleAction = action;
            row.settleNote = trimmed || null;
        }
        return repo.save(row);
    }
    /** 部分退款（fork 无 core RefundService，走 OrderService.refundOrder/settleRefund，与 dispatch-admin 同源）。
     * refund 表 shipping/adjustment 列 NOT NULL 必须显式传 0；超额退款抛错。 */
    async refundAmount(ctx, order, amount, reason) {
        var _a, _b;
        const payment = await this.connection.rawConnection.getRepository(core_1.Payment).findOne({
            where: { order: { id: order.id } },
            order: { id: 'DESC' },
        });
        if (!payment)
            throw new core_1.UserInputError('订单无支付记录，无法退款');
        const refunded = await this.connection.rawConnection
            .getRepository(core_1.Refund)
            .createQueryBuilder('r')
            .select('COALESCE(SUM(r.total), 0)', 'sum')
            .where('r."paymentId" = :pid', { pid: payment.id })
            .getRawOne();
        if (Number((_a = refunded === null || refunded === void 0 ? void 0 : refunded.sum) !== null && _a !== void 0 ? _a : 0) + amount > Number(payment.amount)) {
            throw new core_1.UserInputError('退款金额超过可退余额（订单可能已全额退款）');
        }
        const created = await this.orderService.refundOrder(ctx, {
            paymentId: payment.id,
            amount,
            shipping: 0,
            adjustment: 0,
            reason,
        });
        if (!created || created.errorCode) {
            throw new core_1.UserInputError(`退款失败：${(_b = created === null || created === void 0 ? void 0 : created.errorCode) !== null && _b !== void 0 ? _b : '未知原因'}`);
        }
        await this.orderService.settleRefund(ctx, { id: created.id });
        return created;
    }
    async loadOrder(ctx, orderId) {
        const order = await this.connection
            .getRepository(ctx, core_1.Order)
            .createQueryBuilder('order')
            .leftJoinAndSelect('order.channels', 'channel')
            .leftJoinAndSelect('order.customer', 'customer')
            .where('order.id = :id', { id: orderId })
            .getOne();
        if (!order)
            throw new core_1.UserInputError('订单不存在');
        return order;
    }
    assertNotCancelledOrDelivered(order) {
        var _a;
        const cf = ((_a = order.customFields) !== null && _a !== void 0 ? _a : {});
        if (order.state === 'Cancelled')
            throw new core_1.UserInputError('订单已取消，无法改址');
        if (cf.deliveredAt)
            throw new core_1.UserInputError('订单已送达，无法改址');
    }
    async resolveTarget(ctx, zoneId, buildingId) {
        const zone = await this.connection.getRepository(ctx, campus_zone_entity_1.CampusZone).findOne({
            where: { id: zoneId },
        });
        if (!zone)
            throw new core_1.UserInputError('分区不存在');
        const building = await this.connection.getRepository(ctx, campus_building_entity_1.CampusBuilding).findOne({
            where: { id: buildingId },
        });
        if (!building)
            throw new core_1.UserInputError('宿舍楼不存在');
        if (Number(building.zoneId) !== Number(zone.id))
            throw new core_1.UserInputError('楼栋不属于所选分区');
        if (Number(building.channelId) !== Number(zone.channelId))
            throw new core_1.UserInputError('楼栋不属于所选分区');
        return { zone, building };
    }
    async applyChange(ctx, order, zone, building, detail, actor) {
        var _a, _b, _c, _d, _e, _f;
        const channelId = this.channelIdOf(order, ctx);
        const cfg = await this.connection.rawConnection.getRepository(campus_fulfillment_config_entity_1.CampusFulfillmentConfig).findOne({
            where: { channelId: channelId },
        });
        const cf = ((_a = order.customFields) !== null && _a !== void 0 ? _a : {});
        const oldFee = Number((_b = order.shippingWithTax) !== null && _b !== void 0 ? _b : 0);
        const quote = await (0, shipping_calculator_1.quoteZoneFee)(this.connection, channelId, { name: zone.name, fee: Number(zone.fee) }, cfg, order);
        const newFee = Number((_c = quote === null || quote === void 0 ? void 0 : quote.price) !== null && _c !== void 0 ? _c : oldFee);
        const diff = newFee - oldFee;
        const fromZone = String((_d = cf.campusZone) !== null && _d !== void 0 ? _d : '');
        const fromBuilding = String((_e = cf.buildingId) !== null && _e !== void 0 ? _e : '');
        const fromDetail = (_f = cf.deliveryDetail) !== null && _f !== void 0 ? _f : null;
        const toDetail = (detail === null || detail === void 0 ? void 0 : detail.trim()) || fromDetail;
        const record = await this.connection.getRepository(ctx, campus_address_change_entity_1.CampusAddressChange).save(new campus_address_change_entity_1.CampusAddressChange({
            channelId,
            orderId: Number(order.id),
            orderCode: order.code,
            customerId: actor.customerId,
            fromZone,
            fromBuilding,
            fromDetail,
            toZone: zone.name,
            toBuilding: building.name,
            toDetail,
            oldFee,
            newFee,
            diff,
            status: diff === 0 ? 'settled' : 'pending',
            settledAt: diff === 0 ? new Date() : null,
            settleAction: diff === 0 ? 'waive' : null,
            source: actor.source,
            reason: actor.reason,
            changedBy: actor.changedBy,
        }));
        await this.orderService.updateCustomFields(ctx, order.id, {
            buildingId: String(building.id),
            campusZone: zone.name,
            deliveryDetail: toDetail,
        });
        core_1.Logger.info(`address change [${actor.source}] order=${order.code} ${fromZone}/${fromBuilding} -> ${zone.name}/${building.name} diff=${diff}`, loggerCtx);
        return {
            diff,
            oldFee,
            newFee,
            fromZone,
            toZone: zone.name,
            recordId: record.id,
        };
    }
    channelIdOf(order, ctx) {
        var _a;
        const channels = order.channels;
        const own = (channels !== null && channels !== void 0 ? channels : []).find(c => c.code !== '__default_channel__');
        return ((_a = own === null || own === void 0 ? void 0 : own.id) !== null && _a !== void 0 ? _a : ctx.channelId);
    }
};
exports.AddressChangeService = AddressChangeService;
exports.AddressChangeService = AddressChangeService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.OrderService,
        core_1.CustomerService,
        capacity_service_1.CapacityService])
], AddressChangeService);
//# sourceMappingURL=address-change.service.js.map
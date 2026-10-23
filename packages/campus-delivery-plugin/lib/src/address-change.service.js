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
const shipping_calculator_1 = require("./shipping-calculator");
const loggerCtx = 'CampusAddressChange';
/** 外部配送已接单/取货后不可改址 */
const THIRD_PARTY_LOCKED = ['accepted', 'pickup', 'delivered'];
let AddressChangeService = class AddressChangeService {
    constructor(connection, orderService, customerService) {
        this.connection = connection;
        this.orderService = orderService;
        this.customerService = customerService;
    }
    /** 顾客自助改址（取货前、可跨分区）。差额不阻塞改址，写入台账待运营结算。 */
    async changeByCustomer(ctx, input) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        if (!ctx.activeUserId)
            throw new core_1.ForbiddenError();
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer)
            throw new core_1.ForbiddenError();
        const order = await this.connection
            .getRepository(ctx, core_1.Order)
            .createQueryBuilder('order')
            .leftJoinAndSelect('order.channels', 'channel')
            .leftJoinAndSelect('order.customer', 'customer')
            .where('order.id = :id', { id: input.orderId })
            .getOne();
        if (!order)
            throw new core_1.UserInputError('订单不存在');
        if (((_a = order.customer) === null || _a === void 0 ? void 0 : _a.id) !== customer.id)
            throw new core_1.ForbiddenError();
        const cf = ((_b = order.customFields) !== null && _b !== void 0 ? _b : {});
        if (order.state === 'Cancelled')
            throw new core_1.UserInputError('订单已取消，无法改址');
        if (cf.deliveredAt)
            throw new core_1.UserInputError('订单已送达，无法改址');
        if (cf.deliveryStatus === 'in_progress')
            throw new core_1.UserInputError('骑手已取货，无法自助改址，请联系客服');
        if (THIRD_PARTY_LOCKED.includes(cf.thirdPartyState))
            throw new core_1.UserInputError('外部配送已接单，无法自助改址');
        const zone = await this.connection.getRepository(ctx, campus_zone_entity_1.CampusZone).findOne({
            where: { id: input.zoneId },
        });
        if (!zone)
            throw new core_1.UserInputError('分区不存在');
        const building = await this.connection.getRepository(ctx, campus_building_entity_1.CampusBuilding).findOne({
            where: { id: input.buildingId },
        });
        if (!building)
            throw new core_1.UserInputError('宿舍楼不存在');
        if (Number(building.zoneId) !== Number(zone.id))
            throw new core_1.UserInputError('楼栋不属于所选分区');
        const channelId = this.channelIdOf(order, ctx);
        const cfg = await this.connection.rawConnection.getRepository(campus_fulfillment_config_entity_1.CampusFulfillmentConfig).findOne({
            where: { channelId: channelId },
        });
        const oldFee = Number((_c = order.shippingWithTax) !== null && _c !== void 0 ? _c : 0);
        const quote = await (0, shipping_calculator_1.quoteZoneFee)(this.connection, channelId, { name: zone.name, fee: Number(zone.fee) }, cfg, order);
        const newFee = Number((_d = quote === null || quote === void 0 ? void 0 : quote.price) !== null && _d !== void 0 ? _d : oldFee);
        const diff = newFee - oldFee;
        const fromZone = String((_e = cf.campusZone) !== null && _e !== void 0 ? _e : '');
        const fromBuilding = String((_f = cf.buildingId) !== null && _f !== void 0 ? _f : '');
        const fromDetail = (_g = cf.deliveryDetail) !== null && _g !== void 0 ? _g : null;
        const toDetail = ((_h = input.detail) === null || _h === void 0 ? void 0 : _h.trim()) || fromDetail;
        const record = await this.connection.getRepository(ctx, campus_address_change_entity_1.CampusAddressChange).save(new campus_address_change_entity_1.CampusAddressChange({
            channelId,
            orderId: Number(order.id),
            orderCode: order.code,
            customerId: customer.id,
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
        }));
        await this.orderService.updateCustomFields(ctx, order.id, {
            buildingId: String(building.id),
            campusZone: zone.name,
            deliveryDetail: toDetail,
        });
        core_1.Logger.info(`address change order=${order.code} ${fromZone}/${fromBuilding} -> ${zone.name}/${building.name} diff=${diff}`, loggerCtx);
        return {
            diff,
            oldFee,
            newFee,
            fromZone,
            toZone: zone.name,
            recordId: record.id,
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
    /** 运营结清：refund=已退顾客 / collect=已补收 / waive=免收 / pending=撤销结清 */
    async settle(ctx, id, action) {
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
        if (action === 'pending') {
            row.status = 'pending';
            row.settledAt = null;
            row.settledBy = null;
            row.settleAction = null;
        }
        else {
            row.status = 'settled';
            row.settledAt = new Date();
            row.settledBy = ((_a = ctx.activeUserId) !== null && _a !== void 0 ? _a : null);
            row.settleAction = action;
        }
        return repo.save(row);
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
        core_1.CustomerService])
], AddressChangeService);
//# sourceMappingURL=address-change.service.js.map
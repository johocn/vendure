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
exports.RiderTaskService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const coupon_plugin_1 = require("@vendure/coupon-plugin");
const campus_fulfillment_config_entity_1 = require("./campus-fulfillment-config.entity");
const campus_notify_service_1 = require("./campus-notify.service");
const hall_service_1 = require("./hall.service");
const rider_credit_service_1 = require("./rider-credit.service");
const rider_earning_entity_1 = require("./rider-earning.entity");
const rider_service_1 = require("./rider.service");
let RiderTaskService = class RiderTaskService {
    constructor(connection, riderService, credit, hall, notify) {
        this.connection = connection;
        this.riderService = riderService;
        this.credit = credit;
        this.hall = hall;
        this.notify = notify;
    }
    /** 订单骑手卡信息：C 端订单跟踪轮询用。未指派返回 null。 */
    async orderRider(ctx, orderId) {
        var _a, _b, _c, _d, _e;
        const order = await this.connection.getRepository(ctx, core_1.Order).findOne({ where: { id: orderId } });
        const riderId = Number((_b = (_a = order === null || order === void 0 ? void 0 : order.customFields) === null || _a === void 0 ? void 0 : _a.deliveryStaffId) !== null && _b !== void 0 ? _b : NaN);
        if (!riderId)
            return null;
        const rider = await this.connection.getRepository(ctx, core_1.Customer).findOne({ where: { id: riderId } });
        if (!rider)
            return null;
        const cf = ((_c = rider.customFields) !== null && _c !== void 0 ? _c : {});
        return { realName: (_d = cf.riderRealName) !== null && _d !== void 0 ? _d : '骑手', credit: (_e = cf.riderCredit) !== null && _e !== void 0 ? _e : 100 };
    }
    /** 我的任务：本骑手名下已进入配送流程的订单，按下单时间倒序。
     * customFields 为嵌入式物理列，QueryBuilder 用 embedded 路径 order.customFields.deliveryStaffId
     * （与 delivery-plugin 写法一致），裸列 order.deliveryStaffId 在 PG 不存在。
     * 渠道过滤：Order 无标量 channelId，join order.channels 过滤 channel.id（同 hall()）。 */
    async myTasks(ctx, status) {
        const rider = await this.riderService.assertApprovedRider(ctx);
        const qb = this.connection
            .getRepository(ctx, core_1.Order)
            .createQueryBuilder('order')
            .leftJoin('order.channels', 'channel')
            .where('channel.id = :ch', { ch: ctx.channelId })
            .andWhere('order.customFields.deliveryStaffId = :id', { id: String(rider.id) })
            .andWhere('order.customFields.deliveryStatus IS NOT NULL');
        if (status) {
            qb.andWhere('order.customFields.deliveryStatus = :s', { s: status });
        }
        return qb.orderBy('order.createdAt', 'DESC').getMany();
    }
    /** 转单回大厅：assigned 未取货直接回；in_progress 已取货必须拍照交接存证。
     * 回大厅复用 backToHall（清骑手指派、hallStatus 复位 open），存证写 transferPhotos。
     * 一期转单不扣信用分（规则后续租户可配）。 */
    async transfer(ctx, orderId, photos, note) {
        const order = await this.assertOwner(ctx, orderId);
        const status = order.customFields.deliveryStatus;
        if (status === 'in_progress' && !(photos === null || photos === void 0 ? void 0 : photos.length)) {
            throw new core_1.UserInputError('已取货转单需拍照交接');
        }
        if (status !== 'assigned' && status !== 'in_progress') {
            throw new core_1.UserInputError('当前状态不允许转单');
        }
        await this.hall.backToHall(ctx, order.id);
        if (photos === null || photos === void 0 ? void 0 : photos.length) {
            await this.connection.getRepository(ctx, core_1.Order).update(order.id, {
                customFields: {
                    transferPhotos: photos,
                    transferNote: note !== null && note !== void 0 ? note : null,
                    transferAt: new Date(),
                },
            });
        }
        return order;
    }
    /** 开始配送：assigned → in_progress */
    async start(ctx, orderId) {
        const order = await this.assertOwner(ctx, orderId, 'assigned');
        await this.connection
            .getRepository(ctx, core_1.Order)
            .update(order.id, { customFields: { deliveryStatus: 'in_progress' } });
        return order;
    }
    /** 送达：拍照必传 → delivered → 分成入余额（0 分成单跳过入账） */
    async deliver(ctx, orderId, photos, note) {
        var _a, _b;
        if (!(photos === null || photos === void 0 ? void 0 : photos.length))
            throw new core_1.UserInputError('送达需至少一张照片');
        const order = await this.assertOwner(ctx, orderId, 'in_progress');
        const rider = await this.riderService.assertApprovedRider(ctx);
        const earning = this.calcEarning(order, await this.getConfig(ctx));
        const tip = (_a = order.customFields.tip) !== null && _a !== void 0 ? _a : 0;
        await this.connection.getRepository(ctx, core_1.Order).update(order.id, {
            customFields: {
                deliveryStatus: 'delivered',
                deliveredAt: new Date(),
                deliveryPhotos: photos,
                deliveryNote: note !== null && note !== void 0 ? note : null,
                riderEarning: earning,
            },
        });
        if (earning === 0 && tip === 0) {
            // 0 分成单：不写 earning 不调 addBalance（余额端口对 0 金额入账会抛错）
            common_1.Logger.log(`订单 ${(_b = order.code) !== null && _b !== void 0 ? _b : order.id} 0 分成，跳过入账`, 'RiderTask');
        }
        else {
            await this.connection.getRepository(ctx, rider_earning_entity_1.RiderEarning).save({
                orderId: order.id,
                riderCustomerId: rider.id,
                amount: earning,
                tip,
                status: 'credited',
                channelId: ctx.channelId,
            });
            const port = (0, coupon_plugin_1.getCouponBalancePort)();
            if (port) {
                await port.addBalance(ctx, rider.id, earning);
            }
            else {
                common_1.Logger.warn('余额端口未注册，分成未入账', 'RiderTask');
            }
        }
        // 完单信用加分（+2）
        await this.credit.adjust(ctx, rider.id, rider_credit_service_1.CREDIT_COMPLETE, 'complete', order.id);
        // 通知下单用户已送达（fire-and-forget）
        this.notify.user(ctx, order.id, 'orderDelivered');
        return order;
    }
    /** 异常上报：不校验状态，标记 exception */
    async reportException(ctx, orderId, type, photos, note) {
        const order = await this.assertOwner(ctx, orderId);
        await this.connection.getRepository(ctx, core_1.Order).update(order.id, {
            customFields: {
                deliveryStatus: 'exception',
                exceptionType: type,
                exceptionPhotos: photos,
                exceptionNote: note !== null && note !== void 0 ? note : null,
            },
        });
        return order;
    }
    calcEarning(order, cfg) {
        var _a;
        // 跑腿单：跑腿费在 orderLines 单价中（虚拟商品 0 元时全在 shipping）；统一取 shipping + 小费
        const shipping = order.shipping || 0;
        const tip = (_a = order.customFields.tip) !== null && _a !== void 0 ? _a : 0;
        return Math.floor(((shipping + tip) * cfg.riderCommissionRate) / 100);
    }
    async getConfig(ctx) {
        const cfg = await this.connection
            .getRepository(ctx, campus_fulfillment_config_entity_1.CampusFulfillmentConfig)
            .findOne({ where: { channelId: ctx.channelId } });
        if (!cfg)
            throw new core_1.UserInputError('校园履约未配置');
        return cfg;
    }
    async assertOwner(ctx, orderId, expect) {
        const rider = await this.riderService.assertApprovedRider(ctx);
        const order = await this.connection
            .getRepository(ctx, core_1.Order)
            .findOne({ where: { id: orderId }, relations: ['customer'] });
        const cf = order === null || order === void 0 ? void 0 : order.customFields;
        if (!order || (cf === null || cf === void 0 ? void 0 : cf.deliveryStaffId) !== String(rider.id))
            throw new core_1.ForbiddenError();
        if (expect && (cf === null || cf === void 0 ? void 0 : cf.deliveryStatus) !== expect) {
            throw new core_1.UserInputError(`当前状态不允许该操作（期望 ${expect}）`);
        }
        return order;
    }
};
exports.RiderTaskService = RiderTaskService;
exports.RiderTaskService = RiderTaskService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        rider_service_1.RiderService,
        rider_credit_service_1.RiderCreditService,
        hall_service_1.HallService,
        campus_notify_service_1.CampusNotifyService])
], RiderTaskService);
//# sourceMappingURL=rider-task.service.js.map
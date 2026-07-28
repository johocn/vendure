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
exports.GroupBuyJob = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const group_buy_activity_entity_1 = require("./group-buy-activity.entity");
const group_buy_order_entity_1 = require("./group-buy-order.entity");
const constants_1 = require("./constants");
let GroupBuyJob = class GroupBuyJob {
    constructor(connection, orderService, paymentService, channelService) {
        this.connection = connection;
        this.orderService = orderService;
        this.paymentService = paymentService;
        this.channelService = channelService;
        this.stockPrewarmService = null;
    }
    initStock(injector) {
        try {
            const { StockPrewarmService } = require('@vendure/redis-stock-plugin');
            this.stockPrewarmService = injector.get(StockPrewarmService);
        }
        catch (_a) {
            // RedisStockPlugin not installed
        }
    }
    // 由 GroupBuyScheduledTask 每分钟触发，避免多实例内存 setTimeout 并发。
    async runCheck(ctx) {
        const channels = await this.channelService.findAll(ctx);
        for (const channel of channels.items) {
            const channelCtx = new core_1.RequestContext({
                apiType: 'admin',
                channel,
                isAuthorized: true,
                authorizedAsOwnerOnly: false,
            });
            const activityRepo = this.connection.getRepository(channelCtx, group_buy_activity_entity_1.GroupBuyActivity);
            const orderRepo = this.connection.getRepository(channelCtx, group_buy_order_entity_1.GroupBuyOrder);
            const now = new Date();
            const expiredActivities = await activityRepo
                .createQueryBuilder('gba')
                .innerJoin('gba.channels', 'channel', 'channel.id = :channelId', { channelId: channel.id })
                .where('gba.endAt < :now', { now })
                .andWhere('gba.status = :status', { status: 'active' })
                .getMany();
            for (const activity of expiredActivities) {
                if (activity.currentCount >= activity.targetCount) {
                    activity.status = 'completed';
                }
                else {
                    activity.status = 'expired';
                }
                await activityRepo.save(activity);
                if (this.stockPrewarmService) {
                    await this.stockPrewarmService.removePrewarm(`group-buy:${activity.id}`);
                }
                if (activity.status === 'expired') {
                    const pendingOrders = await orderRepo.find({
                        where: { groupBuyActivityId: activity.id, status: 'pending' },
                    });
                    for (const gbo of pendingOrders) {
                        try {
                            await this.orderService.cancelOrder(channelCtx, { orderId: gbo.orderId });
                            await this.refundOrderPayments(channelCtx, gbo.orderId);
                            gbo.status = 'failed';
                            await orderRepo.save(gbo);
                            core_1.Logger.info(`Cancelled and refunded group buy order ${gbo.orderId} for expired activity ${activity.id}`, constants_1.loggerCtx);
                        }
                        catch (e) {
                            core_1.Logger.error(`Failed to cancel group buy order ${gbo.orderId}: ${e.message}`, constants_1.loggerCtx);
                        }
                    }
                }
                else {
                    const pendingOrders = await orderRepo.find({
                        where: { groupBuyActivityId: activity.id, status: 'pending' },
                    });
                    for (const gbo of pendingOrders) {
                        gbo.status = 'success';
                        await orderRepo.save(gbo);
                    }
                }
                core_1.Logger.info(`Activity ${activity.id} status changed to ${activity.status}`, constants_1.loggerCtx);
            }
        }
    }
    async refundOrderPayments(ctx, orderId) {
        var _a;
        const order = await this.connection.getRepository(ctx, core_1.Order).findOne({
            where: { id: orderId },
            relations: ['payments'],
        });
        if (!((_a = order === null || order === void 0 ? void 0 : order.payments) === null || _a === void 0 ? void 0 : _a.length)) {
            return;
        }
        for (const payment of order.payments) {
            if (payment.state === 'Settled') {
                try {
                    const result = await this.paymentService.createRefund(ctx, {
                        paymentId: payment.id,
                        amount: payment.amount,
                        reason: 'Group buy failed/expired',
                    }, order, payment);
                    if (result instanceof Error) {
                        core_1.Logger.warn(`Refund for payment ${payment.id} returned error: ${result.message}`, constants_1.loggerCtx);
                    }
                }
                catch (e) {
                    core_1.Logger.error(`Failed to refund payment ${payment.id} for order ${orderId}: ${e.message}`, constants_1.loggerCtx);
                }
            }
        }
    }
};
exports.GroupBuyJob = GroupBuyJob;
exports.GroupBuyJob = GroupBuyJob = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.OrderService,
        core_1.PaymentService,
        core_1.ChannelService])
], GroupBuyJob);
//# sourceMappingURL=group-buy.job.js.map
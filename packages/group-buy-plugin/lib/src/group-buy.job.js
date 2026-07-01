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
    constructor(jobQueueService, connection, orderService, channelService) {
        this.jobQueueService = jobQueueService;
        this.connection = connection;
        this.orderService = orderService;
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
    async init() {
        this.jobQueue = await this.jobQueueService.createQueue({
            name: 'group-buy-check',
            process: async (job) => {
                try {
                    const emptyCtx = core_1.RequestContext.empty();
                    const channels = await this.channelService.findAll(emptyCtx);
                    for (const channel of channels.items) {
                        const ctx = new core_1.RequestContext({
                            apiType: 'admin',
                            channel,
                            isAuthorized: true,
                            authorizedAsOwnerOnly: false,
                        });
                        const activityRepo = this.connection.getRepository(ctx, group_buy_activity_entity_1.GroupBuyActivity);
                        const orderRepo = this.connection.getRepository(ctx, group_buy_order_entity_1.GroupBuyOrder);
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
                                        await this.orderService.cancelOrder(ctx, { orderId: gbo.orderId });
                                        gbo.status = 'failed';
                                        await orderRepo.save(gbo);
                                        core_1.Logger.info(`Cancelled group buy order ${gbo.orderId} for expired activity ${activity.id}`, constants_1.loggerCtx);
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
                catch (e) {
                    core_1.Logger.error(`Failed to process group buy check: ${e.message}`, constants_1.loggerCtx);
                }
            },
        });
    }
    scheduleCheck() {
        const scheduleNext = () => {
            setTimeout(() => {
                this.jobQueue.add({});
                scheduleNext();
            }, 60 * 1000);
        };
        scheduleNext();
    }
};
exports.GroupBuyJob = GroupBuyJob;
exports.GroupBuyJob = GroupBuyJob = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.JobQueueService,
        core_1.TransactionalConnection,
        core_1.OrderService,
        core_1.ChannelService])
], GroupBuyJob);
//# sourceMappingURL=group-buy.job.js.map
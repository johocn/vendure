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
exports.OrderTimeoutJob = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
let OrderTimeoutJob = class OrderTimeoutJob {
    constructor(jobQueueService, orderService, channelService) {
        this.jobQueueService = jobQueueService;
        this.orderService = orderService;
        this.channelService = channelService;
    }
    async init() {
        this.jobQueue = await this.jobQueueService.createQueue({
            name: 'order-timeout',
            process: async (job) => {
                try {
                    const emptyCtx = core_1.RequestContext.empty();
                    const channel = await this.channelService.findOne(emptyCtx, job.data.channelId);
                    if (!channel) {
                        core_1.Logger.warn(`Channel ${job.data.channelId} not found, skipping timeout job`, constants_1.loggerCtx);
                        return;
                    }
                    const ctx = new core_1.RequestContext({
                        apiType: 'admin',
                        channel,
                        isAuthorized: true,
                        authorizedAsOwnerOnly: false,
                    });
                    const order = await this.orderService.findOne(ctx, job.data.orderId);
                    if (order && order.state === 'ArrangingPayment') {
                        await this.orderService.cancelOrder(ctx, { orderId: job.data.orderId });
                        core_1.Logger.info(`Order ${job.data.orderId} cancelled due to timeout`, constants_1.loggerCtx);
                    }
                }
                catch (e) {
                    core_1.Logger.error(`Failed to process timeout for order ${String(job.data.orderId)}: ${String(e.message)}`, constants_1.loggerCtx);
                }
            },
        });
    }
    async scheduleCancellation(orderId, channelId, timeoutMinutes) {
        setTimeout(() => {
            void this.jobQueue.add({ orderId, channelId });
        }, timeoutMinutes * 60 * 1000);
    }
};
exports.OrderTimeoutJob = OrderTimeoutJob;
exports.OrderTimeoutJob = OrderTimeoutJob = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.JobQueueService,
        core_1.OrderService,
        core_1.ChannelService])
], OrderTimeoutJob);
//# sourceMappingURL=order-timeout.job.js.map
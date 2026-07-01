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
exports.CommissionJob = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const commission_service_1 = require("./commission.service");
const constants_1 = require("./constants");
let CommissionJob = class CommissionJob {
    constructor(jobQueueService, commissionService, channelService) {
        this.jobQueueService = jobQueueService;
        this.commissionService = commissionService;
        this.channelService = channelService;
    }
    async init() {
        this.jobQueue = await this.jobQueueService.createQueue({
            name: 'commission-settlement',
            process: async (job) => {
                try {
                    const emptyCtx = core_1.RequestContext.empty();
                    const channel = await this.channelService.findOne(emptyCtx, job.data.channelId);
                    if (!channel) {
                        core_1.Logger.warn(`Channel ${job.data.channelId} not found, skipping commission settlement`, constants_1.loggerCtx);
                        return;
                    }
                    const ctx = new core_1.RequestContext({
                        apiType: 'admin',
                        channel,
                        isAuthorized: true,
                        authorizedAsOwnerOnly: false,
                    });
                    const count = await this.commissionService.settlePendingCommissions(ctx);
                    core_1.Logger.info(`Settled ${count} pending commissions for channel ${job.data.channelId}`, constants_1.loggerCtx);
                }
                catch (e) {
                    core_1.Logger.error(`Failed to process commission settlement for channel ${job.data.channelId}: ${e.message}`, constants_1.loggerCtx);
                }
            },
        });
    }
    async scheduleSettlement(channelId) {
        setTimeout(() => {
            this.jobQueue.add({ channelId });
        }, 24 * 60 * 60 * 1000);
    }
};
exports.CommissionJob = CommissionJob;
exports.CommissionJob = CommissionJob = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.JobQueueService,
        commission_service_1.CommissionService,
        core_1.ChannelService])
], CommissionJob);
//# sourceMappingURL=commission.job.js.map
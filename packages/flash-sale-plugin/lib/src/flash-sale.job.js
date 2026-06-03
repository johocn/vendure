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
exports.FlashSaleJob = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const flash_sale_activity_entity_1 = require("./flash-sale-activity.entity");
let FlashSaleJob = class FlashSaleJob {
    constructor(jobQueueService, connection) {
        this.jobQueueService = jobQueueService;
        this.connection = connection;
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
            name: 'flash-sale-status',
            process: async (job) => {
                try {
                    await this.processStatusTransitions();
                }
                catch (e) {
                    core_1.Logger.error(`Failed to process flash sale status: ${e.message}`, constants_1.loggerCtx);
                }
            },
        });
    }
    scheduleCheck() {
        this.intervalRef = setInterval(() => {
            this.jobQueue.add({});
        }, 60 * 1000);
    }
    async processStatusTransitions() {
        const repo = this.connection.rawConnection.getRepository(flash_sale_activity_entity_1.FlashSaleActivity);
        const now = new Date();
        const toActivate = await repo
            .createQueryBuilder('fsa')
            .where('fsa.status = :status', { status: 'upcoming' })
            .andWhere('fsa.startAt <= :now', { now })
            .getMany();
        for (const activity of toActivate) {
            activity.status = 'active';
            if (this.stockPrewarmService) {
                await this.stockPrewarmService.prewarm(`flash-sale:${activity.id}`, activity.totalStock - activity.soldCount);
            }
            await repo.save(activity);
            core_1.Logger.info(`FlashSaleActivity ${activity.id} activated`, constants_1.loggerCtx);
        }
        const toEnd = await repo
            .createQueryBuilder('fsa')
            .where('fsa.status = :status', { status: 'active' })
            .andWhere('fsa.endAt <= :now', { now })
            .getMany();
        for (const activity of toEnd) {
            activity.status = 'ended';
            if (this.stockPrewarmService) {
                await this.stockPrewarmService.removePrewarm(`flash-sale:${activity.id}`);
            }
            await repo.save(activity);
            core_1.Logger.info(`FlashSaleActivity ${activity.id} ended`, constants_1.loggerCtx);
        }
    }
};
exports.FlashSaleJob = FlashSaleJob;
exports.FlashSaleJob = FlashSaleJob = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.JobQueueService,
        core_1.TransactionalConnection])
], FlashSaleJob);
//# sourceMappingURL=flash-sale.job.js.map
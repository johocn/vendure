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
const constants_1 = require("./constants");
const group_buy_service_1 = require("./group-buy.service");
let GroupBuyJob = class GroupBuyJob {
    constructor(channelService, groupBuyService) {
        this.channelService = channelService;
        this.groupBuyService = groupBuyService;
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
    // 逐渠道构建 admin ctx 后委托 GroupBuyService.processExpired 处理过期活动。
    async runCheck(ctx) {
        const channels = await this.channelService.findAll(ctx);
        for (const channel of channels.items) {
            const channelCtx = new core_1.RequestContext({
                apiType: 'admin',
                channel,
                isAuthorized: true,
                authorizedAsOwnerOnly: false,
            });
            try {
                const processed = await this.groupBuyService.processExpired(channelCtx);
                if (this.stockPrewarmService) {
                    for (const activity of processed) {
                        await this.stockPrewarmService.removePrewarm(`group-buy:${activity.id}`);
                    }
                }
            }
            catch (e) {
                core_1.Logger.error(`Failed to run group buy expiry check for channel ${channel.code}: ${e.message}`, constants_1.loggerCtx);
            }
        }
    }
};
exports.GroupBuyJob = GroupBuyJob;
exports.GroupBuyJob = GroupBuyJob = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.ChannelService,
        group_buy_service_1.GroupBuyService])
], GroupBuyJob);
//# sourceMappingURL=group-buy.job.js.map
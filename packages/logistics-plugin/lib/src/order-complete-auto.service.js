"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderCompleteAutoService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
/**
 * 自动交易完成：扫描 state='Delivered' 且 fulfillmentDeliveredAt <= now - completeDays 的订单
 * 推进到 Completed。手动（runAutoCompleteScan mutation）/定时（order-complete-auto ScheduledTask）共用。
 * 完成天数：Channel.orderCompleteDays 覆盖 > 插件 defaultCompleteDays > 默认 3 天。
 */
let OrderCompleteAutoService = class OrderCompleteAutoService {
    constructor() {
        this.injector = null;
        this.orderService = null;
        this.channelService = null;
        this.requestContextService = null;
    }
    init(injector) {
        this.injector = injector;
        try {
            this.orderService = injector.get(core_1.OrderService);
        }
        catch (e) {
            core_1.Logger.warn('OrderCompleteAutoService 无法获取 OrderService', constants_1.loggerCtx);
            this.orderService = null;
        }
        try {
            this.channelService = injector.get(core_1.ChannelService);
        }
        catch (e) {
            this.channelService = null;
        }
        try {
            this.requestContextService = injector.get(core_1.RequestContextService);
        }
        catch (e) {
            this.requestContextService = null;
        }
    }
    /** 定时任务入口：构造默认渠道 ctx 后扫描（内部任务，无用户上下文） */
    async runAutoCompleteJob() {
        var _a;
        if (!this.injector)
            return 0;
        try {
            const ctx = this.requestContextService
                ? await this.requestContextService.create({
                    apiType: 'admin',
                    channelOrToken: await this.channelService.getDefaultChannel(),
                })
                : new core_1.RequestContext({
                    apiType: 'admin',
                    channel: await this.channelService.getDefaultChannel(),
                    isAuthorized: true,
                    authorizedAsOwnerOnly: false,
                });
            return await this.runAutoCompleteScan(ctx);
        }
        catch (e) {
            core_1.Logger.warn(`自动交易完成扫描异常: ${(_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e}`, constants_1.loggerCtx);
            return 0;
        }
    }
    /** 扫描并自动完成；返回本次完成订单数 */
    async runAutoCompleteScan(ctx, now = new Date()) {
        var _a, _b, _c, _d, _e, _f;
        if (!this.orderService || !this.injector)
            return 0;
        const connection = this.injector.get(core_1.TransactionalConnection);
        const options = this.injector.get(constants_1.LOGISTICS_PLUGIN_OPTIONS);
        const completeDays = (_d = (_c = (_b = (_a = ctx.channel) === null || _a === void 0 ? void 0 : _a.customFields) === null || _b === void 0 ? void 0 : _b.orderCompleteDays) !== null && _c !== void 0 ? _c : options === null || options === void 0 ? void 0 : options.defaultCompleteDays) !== null && _d !== void 0 ? _d : 3;
        const deadline = new Date(now.getTime() - completeDays * 24 * 60 * 60 * 1000);
        const repo = connection.getRepository(ctx, core_1.Order);
        const candidates = await repo
            .createQueryBuilder('order')
            .where('order.state = :state', { state: 'Delivered' })
            // 注意：不能用 active=true 过滤——core 的 OrderPlacedStrategy 在支付完成时即把
            // order.active 置为 false（下单后订单不再"活跃"），Delivered 都是非 active 订单，
            // 误加 active 过滤会导致所有已完成送达的订单永远扫不到（t8 count 恒为 0）。
            .getMany();
        let done = 0;
        for (const order of candidates) {
            const deliveredAt = (_e = order.customFields) === null || _e === void 0 ? void 0 : _e.fulfillmentDeliveredAt;
            if (!deliveredAt)
                continue;
            if (new Date(deliveredAt).getTime() > deadline.getTime())
                continue;
            const result = await this.orderService.transitionToState(ctx, order.id, 'Completed');
            if (!(0, core_1.isGraphQlErrorResult)(result)) {
                done++;
                core_1.Logger.info(`自动交易完成 order#${(_f = order.code) !== null && _f !== void 0 ? _f : order.id}`, constants_1.loggerCtx);
            }
        }
        if (done > 0) {
            core_1.Logger.info(`自动交易完成扫描: 完成 ${done} 单`, constants_1.loggerCtx);
        }
        return done;
    }
};
exports.OrderCompleteAutoService = OrderCompleteAutoService;
exports.OrderCompleteAutoService = OrderCompleteAutoService = __decorate([
    (0, common_1.Injectable)()
], OrderCompleteAutoService);
//# sourceMappingURL=order-complete-auto.service.js.map
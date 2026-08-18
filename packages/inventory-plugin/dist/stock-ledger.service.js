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
exports.StockLedgerService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const order_stock_ledger_entity_1 = require("./entities/order-stock-ledger.entity");
const loggerCtx = 'StockLedgerService';
let StockLedgerService = class StockLedgerService {
    constructor(connection, listQueryBuilder) {
        this.connection = connection;
        this.listQueryBuilder = listQueryBuilder;
    }
    /**
     * 写一条账本流水（沿用与业务一致的 ctx，若处于事务中则写入同一事务）。
     */
    async record(ctx, input) {
        var _a, _b, _c, _d, _e;
        const direction = (_a = input.direction) !== null && _a !== void 0 ? _a : (input.quantity >= 0 ? 'in' : 'out');
        const entry = new order_stock_ledger_entity_1.OrderStockLedger({
            code: this.generateCode('YSZ'),
            productVariantId: input.productVariantId,
            stockLocationId: input.stockLocationId,
            bizType: input.bizType,
            bizCode: (_b = input.bizCode) !== null && _b !== void 0 ? _b : null,
            orderLineId: input.orderLineId != null ? Number(input.orderLineId) : null,
            direction,
            quantity: Math.abs(input.quantity),
            beforeOnHand: (_c = input.beforeOnHand) !== null && _c !== void 0 ? _c : null,
            afterOnHand: (_d = input.afterOnHand) !== null && _d !== void 0 ? _d : null,
            otherLocationId: input.otherLocationId != null ? Number(input.otherLocationId) : null,
            reason: (_e = input.reason) !== null && _e !== void 0 ? _e : null,
        });
        entry.channels = [ctx.channel];
        const repo = this.connection.getRepository(ctx, order_stock_ledger_entity_1.OrderStockLedger);
        const saved = await repo.save(entry);
        core_1.Logger.debug(`Ledger ${saved.code}: ${saved.bizType}/${saved.direction}/${saved.quantity} @loc#${saved.stockLocationId}`, loggerCtx);
        return saved;
    }
    async list(ctx, options) {
        var _a, _b, _c;
        const queryOptions = {
            skip: (((_a = options === null || options === void 0 ? void 0 : options.page) !== null && _a !== void 0 ? _a : 1) - 1) * ((_b = options === null || options === void 0 ? void 0 : options.pageSize) !== null && _b !== void 0 ? _b : 20),
            take: (_c = options === null || options === void 0 ? void 0 : options.pageSize) !== null && _c !== void 0 ? _c : 20,
            sort: { createdAt: 'DESC' },
        };
        const qb = this.listQueryBuilder
            .build(order_stock_ledger_entity_1.OrderStockLedger, queryOptions, {
            ctx,
            channelId: ctx.channelId,
            entityAlias: 'order_stock_ledger',
        });
        if (options === null || options === void 0 ? void 0 : options.productVariantId)
            qb.andWhere('order_stock_ledger.productVariantId = :vid', { vid: options.productVariantId });
        if (options === null || options === void 0 ? void 0 : options.locationId)
            qb.andWhere('order_stock_ledger.stockLocationId = :lid', { lid: options.locationId });
        if (options === null || options === void 0 ? void 0 : options.bizType)
            qb.andWhere('order_stock_ledger.bizType = :bt', { bt: options.bizType });
        if (options === null || options === void 0 ? void 0 : options.bizCode)
            qb.andWhere('order_stock_ledger.bizCode = :bc', { bc: options.bizCode });
        if (options === null || options === void 0 ? void 0 : options.orderLineId)
            qb.andWhere('order_stock_ledger.orderLineId = :ol', { ol: options.orderLineId });
        const [items, totalItems] = await qb.getManyAndCount();
        return { items, totalItems };
    }
    generateCode(prefix) {
        const now = new Date();
        const ts = now.getFullYear().toString() +
            String(now.getMonth() + 1).padStart(2, '0') +
            String(now.getDate()).padStart(2, '0') +
            String(now.getHours()).padStart(2, '0') +
            String(now.getMinutes()).padStart(2, '0') +
            String(now.getSeconds()).padStart(2, '0');
        const rand = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        return `${prefix}${ts}${rand}`;
    }
};
exports.StockLedgerService = StockLedgerService;
exports.StockLedgerService = StockLedgerService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.ListQueryBuilder])
], StockLedgerService);

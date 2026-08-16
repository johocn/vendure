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
exports.LedgerService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const marketplace_inventory_ledger_entity_1 = require("./entities/marketplace-inventory-ledger.entity");
/**
 * @description
 * 供销存中间表服务：负责写入与查询 `MarketplaceInventoryLedger` 记录。
 * 供 Task10 对账使用，可按商家、销售来源、时间范围等维度聚合查询。
 */
let LedgerService = class LedgerService {
    constructor(connection) {
        this.connection = connection;
    }
    /** 写入一条 ledger 记录 */
    async recordChange(ctx, input) {
        var _a, _b;
        const repo = this.connection.getRepository(ctx, marketplace_inventory_ledger_entity_1.MarketplaceInventoryLedger);
        const ledger = new marketplace_inventory_ledger_entity_1.MarketplaceInventoryLedger({
            variantId: input.variantId,
            merchantChannelId: input.merchantChannelId,
            saleSource: input.saleSource,
            stockBefore: input.stockBefore,
            stockAfter: input.stockAfter,
            stockDelta: input.stockDelta,
            actionType: input.actionType,
            orderId: (_a = input.orderId) !== null && _a !== void 0 ? _a : null,
            validFrom: (_b = input.validFrom) !== null && _b !== void 0 ? _b : new Date(),
            validTo: null,
        });
        return repo.save(ledger);
    }
    /** 按 merchantChannelId 聚合查询 */
    async queryByMerchant(ctx, merchantChannelId, options = {}) {
        const qb = this.connection
            .getRepository(ctx, marketplace_inventory_ledger_entity_1.MarketplaceInventoryLedger)
            .createQueryBuilder('ledger')
            .where('ledger.merchantChannelId = :merchantChannelId', { merchantChannelId });
        this.applyCommonFilters(qb, options);
        qb.orderBy('ledger.validFrom', 'DESC');
        return qb.getMany();
    }
    /** 按销售来源查询 */
    async queryBySaleSource(ctx, saleSource, options = {}) {
        const qb = this.connection
            .getRepository(ctx, marketplace_inventory_ledger_entity_1.MarketplaceInventoryLedger)
            .createQueryBuilder('ledger')
            .where('ledger.saleSource = :saleSource', { saleSource });
        this.applyCommonFilters(qb, options);
        qb.orderBy('ledger.validFrom', 'DESC');
        return qb.getMany();
    }
    /** 按时间范围查询（对账用） */
    async queryByDateRange(ctx, from, to, options = {}) {
        const qb = this.connection
            .getRepository(ctx, marketplace_inventory_ledger_entity_1.MarketplaceInventoryLedger)
            .createQueryBuilder('ledger')
            .where('ledger.validFrom >= :from AND ledger.validFrom <= :to', { from, to });
        this.applyCommonFilters(qb, options);
        qb.orderBy('ledger.validFrom', 'ASC');
        return qb.getMany();
    }
    applyCommonFilters(qb, options) {
        if (options.saleSource) {
            qb.andWhere('ledger.saleSource = :saleSource', { saleSource: options.saleSource });
        }
        if (options.actionType) {
            qb.andWhere('ledger.actionType = :actionType', { actionType: options.actionType });
        }
        if (options.orderId) {
            qb.andWhere('ledger.orderId = :orderId', { orderId: options.orderId });
        }
    }
};
exports.LedgerService = LedgerService;
exports.LedgerService = LedgerService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], LedgerService);

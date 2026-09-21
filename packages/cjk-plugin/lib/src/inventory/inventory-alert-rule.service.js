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
exports.InventoryAlertRuleService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
const inventory_alert_rule_entity_1 = require("./inventory-alert-rule.entity");
const virtual_physical_stock_service_1 = require("./virtual-physical-stock.service");
/**
 * 库存预警规则（安全库存）读写。
 * 读：渠道默认值 + 指定变体集在本租户的规则 + 指定仓规则列表；写：幂等 upsert。
 * 哨兵口径：`locationId = 0` 表示「该 SKU 在本租户全部仓通用」（与实体注释一致）。
 */
let InventoryAlertRuleService = class InventoryAlertRuleService {
    constructor(conn, virtualPhysicalStockService) {
        this.conn = conn;
        this.virtualPhysicalStockService = virtualPhysicalStockService;
    }
    /** 渠道级默认安全库存（未配置/非法 → null，由 resolveSafetyStock 落到常量 10） */
    channelDefault(ctx) {
        var _a, _b;
        const raw = (_b = (_a = ctx.channel) === null || _a === void 0 ? void 0 : _a.customFields) === null || _b === void 0 ? void 0 : _b.inventoryDefaultSafetyStock;
        if (raw === null || raw === undefined || raw === '') {
            return null;
        }
        const n = Number(raw);
        return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : null;
    }
    /** 取指定变体在本租户的全部规则（含 locationId=0 的全仓通用规则） */
    async rulesForVariants(ctx, variantIds) {
        const ids = (variantIds !== null && variantIds !== void 0 ? variantIds : []).map(v => Number(v)).filter(n => Number.isFinite(n));
        if (!ids.length) {
            return [];
        }
        const rows = await this.conn.getRepository(ctx, inventory_alert_rule_entity_1.InventoryAlertRuleEntity).find({
            where: { tenantChannelId: ctx.channel.code, variantId: (0, typeorm_1.In)(ids) },
        });
        return rows.map(r => ({
            variantId: String(r.variantId),
            locationId: String(r.locationId),
            safetyStock: r.safetyStock,
            enabled: r.enabled,
        }));
    }
    /** 哨兵归一：空/缺省 → 0（全仓通用）；非法/负数 → 拒绝 */
    normLocationId(locationId) {
        const raw = locationId === null || locationId === undefined || String(locationId) === '' ? 0 : Number(locationId);
        if (!Number.isFinite(raw) || raw < 0) {
            throw new core_1.UserInputError('仓库 id 非法');
        }
        return Math.trunc(raw);
    }
    /** 指定仓的规则列表（locationId 缺省 → 哨兵 0 = 全仓通用规则） */
    async list(ctx, locationId) {
        const locId = this.normLocationId(locationId);
        return this.conn.getRepository(ctx, inventory_alert_rule_entity_1.InventoryAlertRuleEntity).find({
            where: { tenantChannelId: ctx.channel.code, locationId: locId },
            order: { variantId: 'ASC' },
        });
    }
    /**
     * 幂等 upsert（唯一键 tenantChannelId + variantId + locationId），返回该仓最新规则列表。
     * 校验：非本租户仓 / 变体不存在或不属于当前渠道 / safetyStock < 0 一律拒绝；
     * `safetyStock = 0` 合法（语义 = 该 SKU 不再进入低库存预警）。
     */
    async save(ctx, locationId, items) {
        const locId = this.normLocationId(locationId);
        if (locId > 0) {
            const overview = await this.virtualPhysicalStockService.getTenantInventoryOverview(ctx);
            if (!overview.locations.some(l => Number(l.id) === locId)) {
                throw new core_1.UserInputError('仓库不属于当前租户');
            }
        }
        const list = Array.isArray(items) ? items.filter(Boolean) : [];
        if (!list.length) {
            return this.list(ctx, locId);
        }
        // 变体必须存在且属于当前渠道（避免写入指向他租户/已删变体的脏规则）
        const variantIds = Array.from(new Set(list.map(i => Number(i === null || i === void 0 ? void 0 : i.variantId)).filter(n => Number.isFinite(n))));
        const found = await this.conn
            .getRepository(ctx, core_1.ProductVariant)
            .createQueryBuilder('v')
            .innerJoin('v.channels', 'ch', 'ch.id = :cid', { cid: ctx.channelId })
            .where('v.id IN (:...ids)', { ids: variantIds.length ? variantIds : [0] })
            .andWhere('v.deletedAt IS NULL')
            .select('v.id', 'id')
            .getRawMany();
        const okIds = new Set(found.map(r => Number(r.id)));
        for (const i of list) {
            const vid = Number(i === null || i === void 0 ? void 0 : i.variantId);
            if (!Number.isFinite(vid) || !okIds.has(vid)) {
                throw new core_1.UserInputError(`变体不存在或不属于当前渠道：${String(i === null || i === void 0 ? void 0 : i.variantId)}`);
            }
            const ss = Number(i === null || i === void 0 ? void 0 : i.safetyStock);
            if (!Number.isFinite(ss) || ss < 0) {
                throw new core_1.UserInputError('安全库存不能为负数');
            }
        }
        await this.conn.withTransaction(ctx, async (txCtx) => {
            const repo = this.conn.getRepository(txCtx, inventory_alert_rule_entity_1.InventoryAlertRuleEntity);
            for (const i of list) {
                const vid = Number(i.variantId);
                const safetyStock = Math.trunc(Number(i.safetyStock));
                const enabled = i.enabled === undefined || i.enabled === null ? true : !!i.enabled;
                const exist = await repo.findOne({
                    where: { tenantChannelId: txCtx.channel.code, variantId: vid, locationId: locId },
                });
                if (exist) {
                    exist.safetyStock = safetyStock;
                    exist.enabled = enabled;
                    exist.updatedAt = new Date();
                    await repo.save(exist);
                }
                else {
                    const row = new inventory_alert_rule_entity_1.InventoryAlertRuleEntity();
                    row.tenantChannelId = txCtx.channel.code;
                    row.variantId = vid;
                    row.locationId = locId;
                    row.safetyStock = safetyStock;
                    row.enabled = enabled;
                    row.updatedAt = new Date();
                    await repo.save(row);
                }
            }
        });
        return this.list(ctx, locId);
    }
};
exports.InventoryAlertRuleService = InventoryAlertRuleService;
exports.InventoryAlertRuleService = InventoryAlertRuleService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        virtual_physical_stock_service_1.VirtualPhysicalStockService])
], InventoryAlertRuleService);
//# sourceMappingURL=inventory-alert-rule.service.js.map
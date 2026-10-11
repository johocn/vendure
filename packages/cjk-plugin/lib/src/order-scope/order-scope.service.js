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
exports.OrderScopeService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const redeem_scope_service_1 = require("../tenant/redeem-scope.service");
/**
 * 受限核销员「按配送档案」的订单查询/计数/新单信号服务。
 *
 * 范围判定：超管恒不受限；其余复用 RedeemScopeService（持有 VerifyOrder
 * 权限 → 以 TenantMember.shippingProfileIds 为白名单）。受限时要求订单
 * 所有商品行的 productVariant.customFields.shippingProfileId 都落在白名单
 * 内（任一行缺失或越界 → 整单排除；无行订单排除），与
 * RedeemScopeService.orderInScope 语义一致，只是下推为 QB 谓词。
 */
let OrderScopeService = class OrderScopeService {
    constructor(connection, redeemScopeService) {
        this.connection = connection;
        this.redeemScopeService = redeemScopeService;
    }
    /** 超管恒不受限；其余复用 RedeemScopeService（VerifyOrder → 白名单） */
    async resolveScope(ctx) {
        if (ctx.userHasPermissions([core_1.Permission.SuperAdmin])) {
            return { restricted: false, shippingProfileIds: [] };
        }
        return this.redeemScopeService.resolve(ctx);
    }
    /** 受限：叠加「全部行档案 ∈ 白名单」谓词（与 RedeemScopeService.orderInScope 语义一致） */
    async applyScope(ctx, qb) {
        const scope = await this.resolveScope(ctx);
        if (!scope.restricted) {
            return;
        }
        const allow = scope.shippingProfileIds.map(String);
        if (!allow.length) {
            qb.andWhere('1 = 0');
            return;
        }
        // embedded 列形态（Task 0 探针已固化）：pv.customFields.shippingProfileId 由 QB 自动映射
        // PG 合法形态：主表别名 order/列 id 需引号（order 为保留字）；原生子查询中
        // camelCase 列名（orderId/productVariantId）与 embedded 列（customFieldsShippingprofileid）须带引号
        qb.setParameters({ allow });
        qb.andWhere(`EXISTS (SELECT 1 FROM order_line hasl WHERE hasl."orderId" = "order"."id") AND NOT EXISTS (
                SELECT 1 FROM order_line viol
                INNER JOIN product_variant pv ON pv.id = viol."productVariantId"
                WHERE viol."orderId" = "order"."id"
                  AND (pv."customFieldsShippingprofileid" IS NULL OR CAST(pv."customFieldsShippingprofileid" AS varchar) NOT IN (:...allow))
            )`);
    }
    applyFilter(qb, f) {
        var _a, _b;
        if ((_a = f.states) === null || _a === void 0 ? void 0 : _a.length) {
            qb.andWhere('order.state IN (:...states)', { states: f.states });
        }
        if (f.timeStart) {
            qb.andWhere('order.createdAt >= :timeStart', { timeStart: f.timeStart });
        }
        if (f.timeEnd) {
            qb.andWhere('order.createdAt < :timeEnd', { timeEnd: f.timeEnd });
        }
        const kw = (f.keyword || '').trim();
        if (kw) {
            qb.andWhere(`(order.code ILIKE :kw OR order.customFields.contactName ILIKE :kw
                  OR order.customFields.contactPhone ILIKE :kw OR order.customFields.remark ILIKE :kw)`, { kw: `%${kw}%` });
        }
        if (f.deliveryType) {
            qb.andWhere('order.customFields.deliveryType = :deliveryType', { deliveryType: f.deliveryType });
        }
        if (f.exceptionType) {
            qb.andWhere('order.customFields.exceptionType = :exceptionType', { exceptionType: f.exceptionType });
        }
        if (f.exceptionOnly) {
            qb.andWhere('order.customFields.exceptionType IS NOT NULL');
        }
        if ((_b = f.afterSales) === null || _b === void 0 ? void 0 : _b.length) {
            qb.andWhere('order.customFields.afterSalesStatus IN (:...afterSales)', { afterSales: f.afterSales });
        }
    }
    baseQb(ctx, f) {
        const qb = this.connection
            .getRepository(ctx, core_1.Order)
            .createQueryBuilder('order')
            .innerJoin('order.channels', 'ch', 'ch.id = :cid', { cid: ctx.channelId });
        this.applyFilter(qb, f);
        return qb;
    }
    /**
     * @param relations 由 resolver 的 @Relations(Order) 装饰器按 GraphQL selection 计算（含 Calculated
     * 字段依赖，如 totalQuantity → lines）。与原生 listQueryBuilder 同机制：setFindOptions +
     * relationLoadStrategy:'query'，一对多关系走独立子查询，避免 join 一对多 + take 分页错乱；
     * 未加载 lines 时 GraphQL 序列化 totalQuantity 会抛 InternalServerError（实体 getter 防御）。
     */
    async scopedOrders(ctx, filter, take, skip, relations = []) {
        var _a, _b;
        const qb = this.baseQb(ctx, filter);
        await this.applyScope(ctx, qb);
        // innerJoin(order.channels) 会产生重复行 → 计数须 DISTINCT（clone 先于 setFindOptions，
        // 计数 QB 不携带关系加载配置）
        const totalItems = Number((_b = (_a = (await qb.clone().select('COUNT(DISTINCT order.id)', 'cnt').getRawOne())) === null || _a === void 0 ? void 0 : _a.cnt) !== null && _b !== void 0 ? _b : 0);
        if (relations.length) {
            // eslint-disable-next-line no-console
            console.log('[order-scope][debug] relations =', JSON.stringify(relations));
            qb.setFindOptions({ relations, relationLoadStrategy: 'query' });
        }
        const items = await qb
            .orderBy('order.createdAt', 'DESC')
            .skip(skip)
            .take(take)
            .getMany();
        return { totalItems, items };
    }
    /** N 组计数（每条独立 QB，参数互不冲突）；异常向上抛由前端保留旧值 */
    async scopedOrderCounts(ctx, filters) {
        var _a;
        const out = [];
        for (const f of filters) {
            const qb = this.baseQb(ctx, f);
            await this.applyScope(ctx, qb);
            const row = await qb.select('COUNT(DISTINCT order.id)', 'cnt').getRawOne();
            out.push(Number((_a = row === null || row === void 0 ? void 0 : row.cnt) !== null && _a !== void 0 ? _a : 0));
        }
        return out;
    }
    /**
     * 新单信号：since 之后下单数 + 范围内最大 orderPlacedAt
     *
     * 时区口径（dev 实测定性，勿改回 toISOString() 字符串传参）：
     * 列形态为 timestamp without time zone 且存本地字面（本地 17:40 建单 → 列字面 2026-10-11 17:40:39）。
     * since 以 Date 对象直传：pg 驱动按连接时区序列化为「本地字面+偏移」（实测 2026-10-11T09:40:39.209Z
     * → '2026-10-11T17:40:39.209+08:00'），PG 解析时丢偏移取字面 = 本地日历字面，与列字面对齐；
     * 若传 toISOString() 字符串则被丢 Z 按 UTC 字面比较 → 窗口整体早 8h → 同批单反复命中。
     * 谓词用严格大于：排除「构成上次锚点的最后一单」（含等于会让 count 恒多 1，前端 unread 重复累加）。
     */
    async newOrderSignal(ctx, since) {
        var _a;
        const qb = this.baseQb(ctx, {});
        qb.andWhere('order.createdAt > :timeStart', { timeStart: since });
        await this.applyScope(ctx, qb);
        const rows = await qb
            .select('COUNT(DISTINCT order.id)', 'cnt')
            .addSelect('MAX(order.orderPlacedAt)', 'latest')
            .getRawMany();
        const row = rows[0];
        return {
            count: Number((_a = row === null || row === void 0 ? void 0 : row.cnt) !== null && _a !== void 0 ? _a : 0),
            latestPlacedAt: (row === null || row === void 0 ? void 0 : row.latest) ? new Date(row.latest).toISOString() : null,
        };
    }
};
exports.OrderScopeService = OrderScopeService;
exports.OrderScopeService = OrderScopeService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        redeem_scope_service_1.RedeemScopeService])
], OrderScopeService);
//# sourceMappingURL=order-scope.service.js.map
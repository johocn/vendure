import { EntityHydrator, Injector, Logger, Order, OrderLine, StockLevelService, StockLocation } from '@vendure/core';
import { NearestStockLocationStrategy } from './nearest-stock-location-strategy';
import {
    loggerCtx,
    parseMemberRules,
    parsePriorityConfig,
    rankByMemberRule,
    rankByNearest,
    rankByPriority,
    rankByStockFirst,
} from './matrix-allocators';

const STORE_SUFFIX = '店';
const MARKETPLACE_SUFFIX = '云仓';

interface MatrixDecision {
    rule: 'member' | 'nearest' | 'priority' | 'stock-first';
    level?: string;
}

/**
 * 库存策略矩阵：单一全局 StockLocationStrategy。
 * 继承 NearestStockLocationStrategy（含 MultiChannel 库存核算 + 服务范围门禁 + 自提锚点），
 * 在下单分配时按 渠道 × 配送方式 × 会员等级 判定规则，产出排序后的候选仓后交给父类扣减，
 * 天然产出多仓 LocationWithQuantity[]（余量拆单）。
 */
export class MatrixStockLocationStrategy extends NearestStockLocationStrategy {
    private entityHydrator!: EntityHydrator;
    private stockLevelService!: StockLevelService;

    override async init(injector: Injector): Promise<void> {
        await super.init(injector);
        this.entityHydrator = injector.get(EntityHydrator);
        this.stockLevelService = injector.get(StockLevelService);
    }

    override async forAllocation(
        ctx: import('@vendure/core').RequestContext,
        stockLocations: StockLocation[],
        orderLine: OrderLine,
        quantity: number,
    ): Promise<import('@vendure/core').LocationWithQuantity[]> {
        const order = await this.loadOrder(ctx, orderLine);
        const channelCf = ((ctx.channel as any)?.customFields ?? {}) as Record<string, any>;

        // 渠道隔离：商城(店)/云仓(云仓) 按后缀过滤，无命中则全量（沿用 Marketplace 惯例）
        const suffix = (order as any)?.customFields?.saleSource === 'marketplace' ? MARKETPLACE_SUFFIX : STORE_SUFFIX;
        const pool = stockLocations.filter(loc => loc.name.endsWith(suffix));
        const candidates = pool.length > 0 ? pool : stockLocations;

        // 服务范围门禁 + 锚点由父类 orderByProximity 处理；此处仅按矩阵重排
        const anchor = await this.readAnchor(ctx, orderLine);
        const stockOnHandMap = new Map<string, number>();
        for (const loc of candidates) {
            try {
                const level = await this.stockLevelService.getStockLevel(ctx, (orderLine as any).productVariantId, loc.id);
                stockOnHandMap.set(String(loc.id), level.stockOnHand ?? 0);
            } catch {
                stockOnHandMap.set(String(loc.id), 0);
            }
        }

        const decision = await this.decideRule(ctx, order, candidates, stockOnHandMap);
        const priorityConfig = parsePriorityConfig(channelCf.stockLocationPriority);
        let ranked: StockLocation[];
        switch (decision.rule) {
            case 'member': {
                const rule = parseMemberRules(channelCf.memberStockStrategy)
                    .find(r => r.level === decision.level)!;
                ranked = rankByMemberRule(candidates, rule, priorityConfig, stockOnHandMap, anchor);
                break;
            }
            case 'priority':
                ranked = rankByPriority(candidates, priorityConfig);
                break;
            case 'stock-first':
                ranked = rankByStockFirst(candidates, stockOnHandMap);
                break;
            default:
                ranked = rankByNearest(candidates, anchor);
        }

        Logger.info(
            `矩阵判定 orderLine#${orderLine.id} rule=${decision.rule}${decision.level ? ':' + decision.level : ''} ` +
            `qty=${quantity} locs=${ranked.length}`,
            loggerCtx,
        );

        const result = await super.forAllocation(ctx, ranked, orderLine, quantity);
        await this.persistSplitDetail(ctx, orderLine, result);
        return result;
    }

    /** 按矩阵优先级判定规则：member > shippingStrategy > 默认就近 */
    private async decideRule(
        ctx: import('@vendure/core').RequestContext,
        order: Order | undefined,
        candidates: StockLocation[],
        stockOnHandMap: Map<string, number>,
    ): Promise<MatrixDecision> {
        const channelCf = ((ctx.channel as any)?.customFields ?? {}) as Record<string, any>;
        const rules = parseMemberRules(channelCf.memberStockStrategy);
        if (rules.length > 0) {
            const level = await this.resolveMemberLevel(ctx, order);
            const rule = rules.find(r => r.level === level);
            if (rule) {
                const hasStock = rule.locationIds.some(id =>
                    candidates.some(c => String(c.id) === String(id) && (stockOnHandMap.get(String(id)) ?? 0) > 0));
                if (hasStock) {
                    return { rule: 'member', level };
                }
            }
        }
        switch (channelCf.shippingStrategy) {
            case 'priority':
                return { rule: 'priority' };
            case 'stock-first':
                return { rule: 'stock-first' };
            case 'nearest':
            default:
                return { rule: 'nearest' };
        }
    }

    /** 读取订单 Customer 的会员等级（LV1..LV5），未登录/无等级按 LV1 */
    private async resolveMemberLevel(
        ctx: import('@vendure/core').RequestContext,
        order: Order | undefined,
    ): Promise<string> {
        if (!order) {
            return 'LV1';
        }
        try {
            await this.entityHydrator.hydrate(ctx, order, { relations: ['customer'] });
            const lv = (order.customer as any)?.customFields?.memberLevel;
            return lv != null && Number(lv) >= 1 && Number(lv) <= 5 ? `LV${Number(lv)}` : 'LV1';
        } catch (e: any) {
            Logger.warn(`读取会员等级失败，按 LV1 处理: ${e?.message ?? e}`, loggerCtx);
            return 'LV1';
        }
    }

    private async loadOrder(
        ctx: import('@vendure/core').RequestContext,
        orderLine: OrderLine,
    ): Promise<Order | undefined> {
        if (orderLine.order) {
            return orderLine.order as Order;
        }
        const orderId = (orderLine as any).orderId;
        if (orderId == null) {
            return undefined;
        }
        try {
            return (await this.connection.getRepository(ctx, Order).findOne({ where: { id: orderId as any } })) ?? undefined;
        } catch {
            return undefined;
        }
    }

    private async readAnchor(
        ctx: import('@vendure/core').RequestContext,
        orderLine: OrderLine,
    ): Promise<{ lat: number | null; lng: number | null }> {
        const order = (orderLine.order as (Order | undefined)) ?? await this.loadOrder(ctx, orderLine);
        const cf = ((order as any)?.customFields ?? {}) as Record<string, any>;
        let lat = cf.lat != null ? Number(cf.lat) : NaN;
        let lng = cf.lng != null ? Number(cf.lng) : NaN;
        if (cf.deliveryType === 'pickup' && cf.pickupLat != null && cf.pickupLng != null) {
            lat = Number(cf.pickupLat);
            lng = Number(cf.pickupLng);
        }
        return { lat: isFinite(lat) ? lat : null, lng: isFinite(lng) ? lng : null };
    }

    /** 将拆分明细写入 OrderLine.stockLocationsJson（Task 2 提供字段），同时保留主仓 stockLocationId */
    private async persistSplitDetail(
        ctx: import('@vendure/core').RequestContext,
        orderLine: OrderLine,
        result: import('@vendure/core').LocationWithQuantity[],
    ): Promise<void> {
        try {
            const positive = result.filter(r => r.quantity > 0);
            if (positive.length === 0) {
                return;
            }
            const main = positive[0];
            const details = positive.map(r => ({
                locationId: String(r.location.id),
                quantity: r.quantity,
            }));
            const cf = {
                ...((orderLine.customFields as any) ?? {}),
                stockLocationId: String(main.location.id),
                stockLocationsJson: JSON.stringify(details),
            };
            const repo = this.connection.getRepository(ctx, OrderLine);
            const fresh = await repo.findOne({ where: { id: orderLine.id } as any });
            if (!fresh) {
                return;
            }
            fresh.customFields = cf;
            await repo.save(
                (await import('@vendure/common/lib/pick')).pick(fresh, ['id', 'customFields']) as any,
                { reload: false },
            );
            (orderLine.customFields as any) = cf;
            Logger.info(
                `orderLine#${orderLine.id} 拆分明细 -> ${details.map(d => `${d.locationId}x${d.quantity}`).join(',')}`,
                loggerCtx,
            );
        } catch (e: any) {
            Logger.error(`记录拆分明细失败（不影响下单）: ${e?.message ?? e}`, loggerCtx);
        }
    }
}

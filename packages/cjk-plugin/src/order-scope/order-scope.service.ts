import { Injectable } from '@nestjs/common';
import { Order, Permission, RelationPaths, RequestContext, TransactionalConnection } from '@vendure/core';
import { RedeemScope } from '@vendure/coupon-plugin';

import { RedeemScopeService } from '../tenant/redeem-scope.service';

/** 前端语义过滤入参（时间为已解析的半开区间） */
export interface ScopedOrderFilter {
    states?: string[];
    /** createdAt >= start（ISO，含） */
    timeStart?: string;
    /** createdAt < end（ISO，不含） */
    timeEnd?: string;
    keyword?: string;
    deliveryType?: string;
    exceptionType?: string;
    exceptionOnly?: boolean;
    afterSales?: string[];
}

export interface ScopedOrderList {
    totalItems: number;
    items: Order[];
}

export interface NewOrderSignal {
    count: number;
    /** 窗口内最大 createdAt（ISO），无单为 null——游标与计数同轴（见 newOrderSignal 注释） */
    latestCreatedAt: string | null;
}

/**
 * 受限核销员「按配送档案」的订单查询/计数/新单信号服务。
 *
 * 范围判定：超管恒不受限；其余复用 RedeemScopeService（持有 VerifyOrder
 * 权限 → 以 TenantMember.shippingProfileIds 为白名单）。受限时要求订单
 * 所有商品行的 productVariant.customFields.shippingProfileId 都落在白名单
 * 内（任一行缺失或越界 → 整单排除；无行订单排除），与
 * RedeemScopeService.orderInScope 语义一致，只是下推为 QB 谓词。
 */
@Injectable()
export class OrderScopeService {
    constructor(
        private connection: TransactionalConnection,
        private redeemScopeService: RedeemScopeService,
    ) {}

    /** 超管恒不受限；其余复用 RedeemScopeService（VerifyOrder → 白名单） */
    async resolveScope(ctx: RequestContext): Promise<RedeemScope> {
        if (ctx.userHasPermissions([Permission.SuperAdmin])) {
            return { restricted: false, shippingProfileIds: [] };
        }
        return this.redeemScopeService.resolve(ctx);
    }

    /** 受限：叠加「全部行档案 ∈ 白名单」谓词（与 RedeemScopeService.orderInScope 语义一致） */
    private async applyScope(ctx: RequestContext, qb: any): Promise<void> {
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
        qb.andWhere(
            `EXISTS (SELECT 1 FROM order_line hasl WHERE hasl."orderId" = "order"."id") AND NOT EXISTS (
                SELECT 1 FROM order_line viol
                INNER JOIN product_variant pv ON pv.id = viol."productVariantId"
                WHERE viol."orderId" = "order"."id"
                  AND (pv."customFieldsShippingprofileid" IS NULL OR CAST(pv."customFieldsShippingprofileid" AS varchar) NOT IN (:...allow))
            )`,
        );
    }

    private applyFilter(qb: any, f: ScopedOrderFilter): void {
        if (f.states?.length) {
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
            qb.andWhere(
                `(order.code ILIKE :kw OR order.customFields.contactName ILIKE :kw
                  OR order.customFields.contactPhone ILIKE :kw OR order.customFields.remark ILIKE :kw)`,
                { kw: `%${kw}%` },
            );
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
        if (f.afterSales?.length) {
            qb.andWhere('order.customFields.afterSalesStatus IN (:...afterSales)', { afterSales: f.afterSales });
        }
    }

    private baseQb(ctx: RequestContext, f: ScopedOrderFilter) {
        const qb = this.connection
            .getRepository(ctx, Order)
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
    async scopedOrders(
        ctx: RequestContext,
        filter: ScopedOrderFilter,
        take: number,
        skip: number,
        relations: RelationPaths<Order> = [],
    ): Promise<ScopedOrderList> {
        const qb = this.baseQb(ctx, filter);
        await this.applyScope(ctx, qb);
        // innerJoin(order.channels) 会产生重复行 → 计数须 DISTINCT（clone 先于 setFindOptions，
        // 计数 QB 不携带关系加载配置）
        const totalItems = Number((await qb.clone().select('COUNT(DISTINCT order.id)', 'cnt').getRawOne())?.cnt ?? 0);
        if (relations.length) {
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
    async scopedOrderCounts(ctx: RequestContext, filters: ScopedOrderFilter[]): Promise<number[]> {
        const out: number[] = [];
        for (const f of filters) {
            const qb = this.baseQb(ctx, f);
            await this.applyScope(ctx, qb);
            const row = await qb.select('COUNT(DISTINCT order.id)', 'cnt').getRawOne();
            out.push(Number(row?.cnt ?? 0));
        }
        return out;
    }

    /**
     * 新单信号：since 之后建单数 + 窗口内最大 createdAt
     *
     * 游标同轴铁律（2026-10-12 修复重复播报）：计数谓词与游标必须同用 createdAt 轴——
     * 此前游标取 MAX(orderPlacedAt)（下单轴）两轴脱节：未付款单 orderPlacedAt 为 null，
     * 窗口内只有未付款单时前端游标不前进 → 每 30s 重播横幅+语音且 unread 无限累加；
     * 窗口内有付款单时，建单时间晚于该单 orderPlacedAt 的未付款单也会每轮重复计数。
     * 同轴后 MAX(createdAt) ≥ 一切已计数单的 createdAt，严格大于天然排除（含未付款单）。
     *
     * 时区口径（dev 实测定性，勿改回 toISOString() 字符串传参）：
     * 列形态为 timestamp without time zone 且存本地字面（本地 17:40 建单 → 列字面 2026-10-11 17:40:39）。
     * since 以 Date 对象直传：pg 驱动按连接时区序列化为「本地字面+偏移」（实测 2026-10-11T09:40:39.209Z
     * → '2026-10-11T17:40:39.209+08:00'），PG 解析时丢偏移取字面 = 本地日历字面，与列字面对齐；
     * 若传 toISOString() 字符串则被丢 Z 按 UTC 字面比较 → 窗口整体早 8h → 同批单反复命中。
     * 谓词用严格大于：排除「构成上次锚点的最后一单」（含等于会让 count 恒多 1，前端 unread 重复累加）。
     */
    async newOrderSignal(ctx: RequestContext, since: Date): Promise<NewOrderSignal> {
        const qb = this.baseQb(ctx, {});
        qb.andWhere('order.createdAt > :timeStart', { timeStart: since });
        await this.applyScope(ctx, qb);
        const rows = await qb
            .select('COUNT(DISTINCT order.id)', 'cnt')
            .addSelect('MAX(order.createdAt)', 'latest')
            .getRawMany();
        const row = rows[0];
        return {
            count: Number(row?.cnt ?? 0),
            latestCreatedAt: row?.latest ? new Date(row.latest).toISOString() : null,
        };
    }
}

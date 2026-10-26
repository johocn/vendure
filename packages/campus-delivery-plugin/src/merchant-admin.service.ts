import { Injectable } from '@nestjs/common';
import {
    ID,
    Order,
    OrderService,
    Product,
    RequestContext,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';
import { CampusBuilding } from './campus-building.entity';
import { CampusConfigService } from './campus-config.service';
import { CampusNotifyService } from './campus-notify.service';
import { startOfCampusDay } from './campus-time';
import { ExternalProviderCode } from './route-matrix';
import { HallService } from './hall.service';
import { refundablePayments, settleRefundOrMarkFailed } from './refund-payment';
import { ThirdPartyDeliveryService } from './third-party-delivery.service';
import { normalizePrintMode } from './waimai-store.service';
import { PrivacyNumberService } from './privacy-number.service';

export interface MerchantBoardLine {
    name: string;
    quantity: number;
    price: number;
}

export interface MerchantBoardOrder {
    id: string;
    code: string;
    createdAt: Date;
    total: number;
    shipping: number;
    building: string;
    zone: string;
    slotText: string;
    route: string;
    riderName: string | null;
    note: string | null; // 顾客整单备注（工作台展示 + 小票打印）
    printedAt: Date | null; // 小票最近打印时间（null=未打）
    provider: string | null; // 外部快递：dada / meituan（运营中心派单后写入）
    thirdPartyNo: string | null; // 外部快递平台单号
    handoverCode: string | null; // 交接码（第一段送达交接点后生成，骑手取货时核对）
    lines: MerchantBoardLine[];
}

export interface MerchantBoard {
    paused: boolean;
    merchantConfirmEnabled: boolean;
    printMode: 'off' | 'onPaid' | 'onAccepted';
    storeName: string;
    storePhone: string | null;
    pending: MerchantBoardOrder[];
    cooking: MerchantBoardOrder[];
    awaitingRider: MerchantBoardOrder[];
    delivering: MerchantBoardOrder[];
    pendingDispatch: MerchantBoardOrder[]; // 待运营推送外部快递（R2 / R3-外部）
    thirdParty: MerchantBoardOrder[]; // 外部快递配送中
    ownedPool: MerchantBoardOrder[]; // 待自营快递接单（R3）
    ownedDispatched: MerchantBoardOrder[]; // 自营快递配送中
    merchantDelivering: MerchantBoardOrder[]; // 商户自行送往交接点（R1）
    scheduled: MerchantBoardOrder[]; // 预约单（plan 3.1）：已支付未放量，到点前 30min 自动进入待接单/大厅
    completedToday: number;
    completedTodayAmount: number;
}

/**
 * 商家接单工作台（admin-api，CampusMerchant 权限，渠道隔离 = 商家角色绑定渠道）。
 * 状态机（merchantConfirmEnabled 渠道）：支付 → pending_merchant（待商家接单）
 * → accepted（备餐中，campusMerchantAcceptOrder）→ open（出餐完成入大厅，
 * campusMerchantCookingDone）→ 骑手 grabbed/delivering → delivered。
 */
@Injectable()
export class MerchantAdminService {
    constructor(
        private connection: TransactionalConnection,
        private config: CampusConfigService,
        private hall: HallService,
        private notify: CampusNotifyService,
        private thirdParty: ThirdPartyDeliveryService,
        private orderService: OrderService,
        private privacy: PrivacyNumberService,
    ) {}

    /** 商家侧顾客联系方式（号码保护）：本渠道订单可查，开启后只返回脱敏/虚拟号 */
    async customerContact(ctx: RequestContext, orderId: ID) {
        const order = await this.connection.getRepository(ctx, Order)
            .createQueryBuilder('order')
            .leftJoin('order.channels', 'channel')
            .leftJoinAndSelect('order.customer', 'customer')
            .where('order.id = :id', { id: orderId as any })
            .andWhere('channel.id = :ch', { ch: ctx.channelId as any })
            .getOne();
        if (!order) throw new UserInputError('订单不存在或不属于当前店铺');
        return this.privacy.resolve(ctx, {
            channelId: ctx.channelId,
            orderCode: order.code,
            phone: order.customer?.phoneNumber ?? null,
        });
    }

    async board(ctx: RequestContext): Promise<MerchantBoard> {
        const cfg = await this.config.getConfig(ctx);
        const repo = this.connection.getRepository(ctx, Order);
        const orders = await repo
            .createQueryBuilder('order')
            .leftJoin('order.channels', 'channel')
            .where('channel.id = :ch', { ch: ctx.channelId as any })
            .andWhere('order.customFields.hallStatus IS NOT NULL')
            // 仅拉活跃流转单：排除 delivered / cancelled / exception_final / no_rider_final 等终态，避免历史单无限增长
            .andWhere(
                "order.customFields.hallStatus IN ('pending_merchant','accepted','open','grabbed','pending_dispatch','third_party','owned_pool','owned_dispatched','merchant_delivering','scheduled')",
            )
            .leftJoinAndSelect('order.lines', 'lines')
            .leftJoinAndSelect('lines.productVariant', 'variant')
            .getMany();
        // 今日已送达口径：按校园时区（UTC+8）日界，不随部署服务器时区漂移
        const startOfDay = new Date(startOfCampusDay(Date.now()));
        const deliveredToday = await repo
            .createQueryBuilder('order')
            .leftJoin('order.channels', 'channel')
            .where('channel.id = :ch', { ch: ctx.channelId as any })
            .andWhere("order.customFields.deliveryStatus = 'delivered'")
            .andWhere('order.customFields.deliveredAt >= :start', { start: startOfDay })
            .getMany();

        const active = orders.filter(o => {
            const cf = o.customFields as any;
            // 送达终态不再进流转栏（兼容历史脏数据：hallStatus 仍为 grabbed 但已送达）
            if (cf.deliveryStatus === 'delivered') return false;
            return [
                'pending_merchant', 'accepted', 'open', 'grabbed',
                'pending_dispatch', 'third_party', 'owned_pool', 'owned_dispatched', 'merchant_delivering',
            ].includes(cf.hallStatus);
        });
        // 预约单（scheduled）：按预约锚点升序，供商家提前备料知悉（不进入四栏流转）
        const scheduledOrders = orders
            .filter(o => (o.customFields as any).hallStatus === 'scheduled')
            .sort((a, b) => {
                const ta = new Date((a.customFields as any).scheduledFor ?? 0).getTime();
                const tb = new Date((b.customFields as any).scheduledFor ?? 0).getTime();
                return ta - tb;
            });
        const dtos = await this.toDto(ctx, active);
        const scheduledDtos = await this.toDto(ctx, scheduledOrders);
        const cfOf = (o: Order) => o.customFields as any;
        const pending = dtos.filter((_, i) => cfOf(active[i]).hallStatus === 'pending_merchant');
        const cooking = dtos.filter((_, i) => cfOf(active[i]).hallStatus === 'accepted');
        const awaitingRider = dtos.filter((_, i) => cfOf(active[i]).hallStatus === 'open');
        const delivering = dtos.filter((_, i) => cfOf(active[i]).hallStatus === 'grabbed');
        const pick = (s: string) => dtos.filter((_, i) => cfOf(active[i]).hallStatus === s);
        const completedTodayAmount = deliveredToday.reduce((s, o) => s + (o.total || 0), 0);
        return {
            paused: cfg.paused,
            merchantConfirmEnabled: cfg.merchantConfirmEnabled,
            printMode: normalizePrintMode(cfg.printMode),
            storeName: ctx.channel?.code ?? '',
            storePhone: cfg.storePhone ?? null,
            pending,
            cooking,
            awaitingRider,
            delivering,
            pendingDispatch: pick('pending_dispatch'),
            thirdParty: pick('third_party'),
            ownedPool: pick('owned_pool'),
            ownedDispatched: pick('owned_dispatched'),
            merchantDelivering: pick('merchant_delivering'),
            scheduled: scheduledDtos,
            completedToday: deliveredToday.length,
            completedTodayAmount,
        };
    }

    /** 商家接单确认：pending_merchant → accepted */
    async acceptOrder(ctx: RequestContext, orderId: ID) {
        const order = await this.assertChannelOrder(ctx, orderId, 'pending_merchant');
        // 条件写：与用户取消/调度商家超时兜底并发时，已脱厅单不得被改回 accepted
        const moved = await this.hall.transitionFrom(ctx, Number(order.id), ['pending_merchant'], {
            hallStatus: 'accepted',
        });
        if (!moved) throw new UserInputError('订单状态已变更，请刷新');
        this.notify.user(ctx, order.id as any, 'orderAccepted');
        return { ok: true };
    }

    /** 商家拒单/商品缺货：接单前（pending_merchant）或备餐中（accepted）可拒，
     * 全额退款 + 取消订单（取消后由 Cancelled 转换自动脱厅/释放时段锁位）。
     * 退款幂等口径与 T4/异常处置一致：先查已退总额，仅退剩余部分。 */
    async rejectOrder(ctx: RequestContext, orderId: ID, reason: string) {
        const trimmed = (reason ?? '').trim();
        if (!trimmed) throw new UserInputError('请填写拒单原因');
        if (trimmed.length > 200) throw new UserInputError('拒单原因不能超过 200 个字符');
        const order = await this.assertChannelOrderState(ctx, orderId, ['pending_merchant', 'accepted']);

        // 并发防重退款：拒单是「查已退总额 → 退差额 → 取消」的复合动作，
        // 与 T4/运营处置并发时无锁会双退。用 PG 会话级咨询锁按订单串行化（同连接 runner 持有/释放）。
        const runner = this.connection.rawConnection.createQueryRunner();
        await runner.connect();
        const lockKey = `campus:refund:${order.id}`;
        try {
            const got: any = await runner.query('SELECT pg_try_advisory_lock(hashtext($1)) AS ok', [lockKey]);
            const rows = Array.isArray(got) && Array.isArray(got[0]) ? got[0] : got;
            if (!rows?.[0]?.ok) throw new UserInputError('该订单正在退款处理中，请稍后重试');
            // 锁内复查：等待锁期间订单可能已被 T4/调度超时兜底改派或用户取消，
            // 此时再退款+取消会把已流转的单重复退款
            const fresh = await this.connection.getRepository(ctx, Order).findOne({
                where: { id: order.id as any },
            });
            const freshHs = String((fresh?.customFields as any)?.hallStatus ?? '');
            if (!['pending_merchant', 'accepted'].includes(freshHs)) {
                throw new UserInputError('订单状态已变更，请刷新');
            }

            // 只退成功支付且仍有余额的支付单（避免选中 Declined/Error 重试单导致退款失败）
            for (const picked of await refundablePayments(this.connection, Number(order.id))) {
                const rest = picked.remaining;
                if (rest > 0) {
                    const created: any = await this.orderService.refundOrder(ctx, {
                        paymentId: picked.payment.id,
                        amount: rest,
                        // refund 表 shipping/adjustment 列 NOT NULL，显式给 0（同 T4）
                        shipping: 0,
                        adjustment: 0,
                        reason: `merchant reject (${order.code})`,
                    } as any);
                    if (!created || created.errorCode) {
                        throw new UserInputError(`退款失败：${created?.errorCode ?? '未知原因'}`);
                    }
                    await settleRefundOrMarkFailed(this.connection, this.orderService, ctx, created.id);
                }
            }

            // 先留痕再取消：脱厅只写 hallStatus，不覆盖 campusCause
            await this.hall.updateOrder(ctx, order.id as any, {
                customFields: { campusCause: 'merchant_rejected' },
            } as any);
            const cancelled = await this.orderService.cancelOrder(ctx, {
                orderId: order.id as any,
                reason: `商家拒单：${trimmed}`,
            } as any);
            if (cancelled && (cancelled as any).errorCode) {
                throw new Error(`cancelOrder failed: ${(cancelled as any).errorCode}`);
            }
            this.notify.user(ctx, order.id as any, 'orderCancelled', trimmed);
            return { ok: true };
        } finally {
            try {
                await runner.query('SELECT pg_advisory_unlock(hashtext($1))', [lockKey]);
            } catch {
                // 释放失败交给连接回收兜底
            }
            await runner.release();
        }
    }

    /** 出餐完成：按路线/承运分流（不再统一入抢单大厅） */
    async cookingDone(ctx: RequestContext, orderId: ID) {
        const order = await this.assertChannelOrder(ctx, orderId, 'accepted');
        const cf = order.customFields as any;
        const route = String(cf.fulfillmentRoute ?? '');
        const plan = String(cf.deliveryPlan ?? '');

        let patch: Record<string, unknown>;
        // R1：第一段由商户或自营快递完成，之后才进校园接力大厅
        if (route === 'R1') {
            patch = plan === 'owned'
                // 自营快递接单后送往交接点（cookingDone 即表示可以出发）
                ? { hallStatus: 'owned_dispatched', assignedAt: new Date() }
                : { hallStatus: 'merchant_delivering', assignedAt: new Date() };
        } else if (plan === 'external_courier') {
            // R2 与 R3-外部：等运营中心推送外部快递（assignedAt 标记出餐时刻，未推送超时从此计时）
            patch = { hallStatus: 'pending_dispatch', assignedAt: new Date() };
        } else if (plan === 'owned') {
            // R3-自营：进自营快递池抢单
            patch = { hallStatus: 'owned_pool' };
        } else {
            // R3-传信者：正常入抢单大厅
            patch = { hallStatus: 'open', hallEnteredAt: new Date() };
        }
        // 条件写：与用户取消/调度超时兜底并发时，已脱厅单不得被改回流转态
        const moved = await this.hall.transitionFrom(ctx, Number(order.id), ['accepted'], patch);
        if (!moved) throw new UserInputError('订单状态已变更，请刷新');
        this.notify.user(ctx, order.id as any, 'cookingDone');
        return { ok: true };
    }

    /** 运营中心推送外部快递（选 dada / meituan） */
    async dispatchExternal(ctx: RequestContext, orderId: ID, provider: ExternalProviderCode) {
        await this.assertAnyChannelOrder(ctx, orderId);
        return this.thirdParty.dispatchExternal(ctx, orderId as any, provider);
    }

    /** 取消外部快递（改推另一家 / 回落大厅前） */
    async cancelExternal(ctx: RequestContext, orderId: ID, reason?: string) {
        await this.assertAnyChannelOrder(ctx, orderId);
        return this.thirdParty.cancel(ctx, orderId as any, reason);
    }

    /** 自营快递接单（R1 商户超时转自营 / R3 自营池） */
    async acceptOwned(ctx: RequestContext, orderId: ID) {
        await this.assertAnyChannelOrder(ctx, orderId);
        return this.thirdParty.acceptOwned(ctx, orderId as any);
    }

    /** R1：商户把餐送到校园交接点 → 传信者接力 */
    async markHandoverArrived(ctx: RequestContext, orderId: ID) {
        await this.assertAnyChannelOrder(ctx, orderId);
        return this.thirdParty.completeFirstLeg(ctx, orderId as any, 'merchant_handover');
    }

    /** 自营快递送达（R1/R2 到交接点，R3 到学生） */
    async markOwnedArrived(ctx: RequestContext, orderId: ID) {
        await this.assertAnyChannelOrder(ctx, orderId);
        return this.thirdParty.completeFirstLeg(ctx, orderId as any, 'owned_handover');
    }

    /** 营业开关：商家仅可切换本渠道 paused，其余配置仍归 CampusConfig 管理员 */
    async setPaused(ctx: RequestContext, paused: boolean) {
        await this.config.updateConfig(ctx, { paused });
        return { ok: true };
    }

    /** 小票打印回执：工作台打印成功后回写 waimaiPrintedAt（防重打 + 补打依据），不限订单状态 */
    async markPrinted(ctx: RequestContext, orderId: ID) {
        const order = await this.connection.getRepository(ctx, Order).findOne({
            where: { id: orderId as any },
            relations: ['channels'],
        });
        const inChannel = order?.channels?.some(c => String(c.id) === String(ctx.channelId));
        if (!order || !inChannel) throw new UserInputError('订单不存在或不属于当前店铺');
        await this.hall.updateOrder(ctx, order.id as any, {
            customFields: { waimaiPrintedAt: new Date() },
        } as any);
        return { ok: true };
    }

    /** 一键沽清：商品列表（本渠道），带售罄标记与规格数（搜索按名称模糊） */
    async products(ctx: RequestContext, search?: string, skip?: number, take?: number) {
        const q = String(search ?? '').trim();
        const safeSkip = Math.max(0, Number(skip ?? 0) || 0);
        const safeTake = Math.min(Math.max(Number(take ?? 50) || 50, 1), 200);
        const rows: any = await this.connection.rawConnection.query(
            'SELECT p.id AS "productId", COALESCE(pt.name, \'商品 #\' || p.id) AS name, '
            + 'COALESCE(p."customFieldsWaimaisoldout", false) AS "soldOut", '
            + 'COALESCE(p."customFieldsWaimaimonthlysales", 0) AS "monthlySales", '
            + '(SELECT COUNT(*)::int FROM product_variant pv WHERE pv."productId" = p.id AND pv."deletedAt" IS NULL) AS "variantCount" '
            + 'FROM product p '
            + 'JOIN product_channels_channel pc ON pc."productId" = p.id AND pc."channelId" = $1 '
            + 'LEFT JOIN LATERAL (SELECT name FROM product_translation pt WHERE pt."baseId" = p.id '
            + 'ORDER BY (pt."languageCode" = \'zh_Hans\') DESC LIMIT 1) pt ON true '
            + 'WHERE ($2 = \'\' OR pt.name ILIKE \'%\' || $2 || \'%\') '
            + 'ORDER BY p.id DESC LIMIT $3 OFFSET $4',
            [ctx.channelId, q, safeTake, safeSkip],
        );
        const list = Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : rows;
        const countRows: any = await this.connection.rawConnection.query(
            'SELECT COUNT(*)::int AS n FROM product p '
            + 'JOIN product_channels_channel pc ON pc."productId" = p.id AND pc."channelId" = $1 '
            + 'LEFT JOIN LATERAL (SELECT name FROM product_translation pt WHERE pt."baseId" = p.id '
            + 'ORDER BY (pt."languageCode" = \'zh_Hans\') DESC LIMIT 1) pt ON true '
            + 'WHERE ($2 = \'\' OR pt.name ILIKE \'%\' || $2 || \'%\')',
            [ctx.channelId, q],
        );
        const countList = Array.isArray(countRows) && Array.isArray(countRows[0]) ? countRows[0] : countRows;
        return {
            items: (list ?? []).map((r: any) => ({
                productId: r.productId,
                name: r.name,
                soldOut: Boolean(r.soldOut),
                monthlySales: Number(r.monthlySales ?? 0),
                variantCount: Number(r.variantCount ?? 0),
            })),
            total: Number(countList?.[0]?.n ?? 0),
        };
    }

    /** 沽清开关：售罄仍展示、不可加购；下单前置闸门二次校验 */
    async setProductSoldOut(ctx: RequestContext, productId: ID, soldOut: boolean) {
        const inChannel = await this.connection.getRepository(ctx, Product).createQueryBuilder('product')
            .leftJoin('product.channels', 'channel')
            .where('product.id = :id', { id: productId as any })
            .andWhere('channel.id = :ch', { ch: ctx.channelId as any })
            .getOne();
        if (!inChannel) throw new UserInputError('商品不存在或不属于当前店铺');
        await this.connection.getRepository(ctx, Product).update(productId, {
            customFields: { waimaiSoldOut: Boolean(soldOut) },
        } as any);
        return { ok: true, soldOut: Boolean(soldOut) };
    }

    private async assertAnyChannelOrder(ctx: RequestContext, orderId: ID) {
        const order = await this.connection.getRepository(ctx, Order).findOne({
            where: { id: orderId as any },
            relations: ['channels'],
        });
        const inChannel = order?.channels?.some(c => String(c.id) === String(ctx.channelId));
        if (!order || !inChannel) throw new UserInputError('订单不存在或不属于当前店铺');
        return order;
    }

    private async assertChannelOrder(ctx: RequestContext, orderId: ID, expect: string) {
        return this.assertChannelOrderState(ctx, orderId, [expect]);
    }

    private async assertChannelOrderState(ctx: RequestContext, orderId: ID, expects: string[]) {
        const order = await this.connection.getRepository(ctx, Order).findOne({
            where: { id: orderId as any },
            relations: ['channels'],
        });
        const inChannel = order?.channels?.some(c => String(c.id) === String(ctx.channelId));
        if (!order || !inChannel) throw new UserInputError('订单不存在或不属于当前店铺');
        const hs = (order.customFields as any).hallStatus;
        if (!expects.includes(hs)) {
            throw new UserInputError('当前状态不允许该操作');
        }
        return order;
    }

    /** 组装商家视图 DTO：楼栋名批量查、骑手名批量查，不外泄 admin 内部字段 */
    private async toDto(ctx: RequestContext, orders: Order[]): Promise<MerchantBoardOrder[]> {
        const buildingIds = new Set<string>();
        const riderIds = new Set<number>();
        for (const o of orders) {
            const cf = o.customFields as any;
            if (cf.buildingId) buildingIds.add(String(cf.buildingId));
            if (cf.deliveryStaffId) riderIds.add(Number(cf.deliveryStaffId));
        }
        const buildings = buildingIds.size
            ? await this.connection.getRepository(ctx, CampusBuilding).findByIds([...buildingIds])
            : [];
        const buildingNames = new Map(buildings.map(b => [String(b.id), b.name]));
        const customers = riderIds.size
            ? await this.connection.rawConnection.getRepository('Customer').findByIds([...riderIds])
            : [];
        const riderNames = new Map(
            (customers as any[]).map(c => [String(c.id), c.customFields?.riderRealName ?? '']),
        );
        return orders.map(o => {
            const cf = o.customFields as any;
            return {
                id: String(o.id),
                code: o.code,
                createdAt: o.createdAt,
                total: o.total,
                shipping: o.shipping,
                building: cf.buildingId ? buildingNames.get(String(cf.buildingId)) ?? '' : '',
                zone: cf.campusZone ?? '',
                slotText: cf.deliverySlotText ?? '',
                route: cf.fulfillmentRoute ?? '',
                riderName: cf.deliveryStaffId ? riderNames.get(String(cf.deliveryStaffId)) ?? null : null,
                note: cf.note ?? null,
                printedAt: (cf.waimaiPrintedAt as Date | undefined) ?? null,
                provider: cf.thirdPartyProvider || null,
                thirdPartyNo: cf.thirdPartyNo || null,
                handoverCode: cf.handoverCode || null,
                lines: (o.lines ?? []).map(l => ({
                    name: l.productVariant?.name ?? '',
                    quantity: l.quantity,
                    price: l.unitPrice,
                })),
            };
        });
    }
}

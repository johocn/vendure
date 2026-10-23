import { Injectable } from '@nestjs/common';
import {
    CustomerService,
    ForbiddenError,
    ID,
    Logger,
    Order,
    OrderService,
    Payment,
    Refund,
    RequestContext,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';
import { CampusAddressChange } from './campus-address-change.entity';
import { CampusBuilding } from './campus-building.entity';
import { CampusFulfillmentConfig } from './campus-fulfillment-config.entity';
import { CampusZone } from './campus-zone.entity';
import { CapacityService } from './capacity.service';
import { CampusNotifyService } from './campus-notify.service';
import { quoteZoneFee, readHallBacklog } from './shipping-calculator';
import { parseDynamicPricing, quoteDynamicFee } from './dynamic-pricing';

const loggerCtx = 'CampusAddressChange';

/** 外部配送已接单/取货后不可改址 */
const THIRD_PARTY_LOCKED = ['accepted', 'pickup', 'delivered'];

@Injectable()
export class AddressChangeService {
    constructor(
        private connection: TransactionalConnection,
        private orderService: OrderService,
        private customerService: CustomerService,
        private capacity: CapacityService,
        private notify: CampusNotifyService,
    ) {}

    /** 顾客自助改址（取货前、可跨分区）。差额不阻塞改址，写入台账待运营结算。 */
    async changeByCustomer(
        ctx: RequestContext,
        input: { orderId: ID; zoneId: ID; buildingId: ID; detail?: string },
    ) {
        if (!ctx.activeUserId) throw new ForbiddenError();
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer) throw new ForbiddenError();

        const order = await this.loadOrder(ctx, input.orderId);
        if ((order.customer as any)?.id !== customer.id) throw new ForbiddenError();
        this.assertNotCancelledOrDelivered(order);

        const cf = (order.customFields ?? {}) as any;
        if (cf.deliveryStatus === 'in_progress') throw new UserInputError('骑手已取货，无法自助改址，请联系客服');
        if (THIRD_PARTY_LOCKED.includes(cf.thirdPartyState)) throw new UserInputError('外部配送已接单，无法自助改址');

        const { zone, building } = await this.resolveTarget(ctx, input.zoneId, input.buildingId);
        return this.applyChange(ctx, order, zone, building, input.detail, {
            source: 'customer',
            reason: null,
            changedBy: ctx.activeUserId as any,
            customerId: customer.id,
        });
    }

    /**
     * 运营代客改址：C 端取货后锁死，运营可代改（必须填原因，全程留痕）。
     * 仅「已取消 / 已送达」拒绝；骑手取货、外部已接单均允许代改。
     */
    async adminChange(
        ctx: RequestContext,
        input: { orderId: ID; zoneId: ID; buildingId: ID; detail?: string; reason: string },
    ) {
        const reason = (input.reason ?? '').trim();
        if (!reason) throw new UserInputError('请填写代改原因');
        const order = await this.loadOrder(ctx, input.orderId);
        if (Number(this.channelIdOf(order, ctx)) !== Number(ctx.channelId)) throw new ForbiddenError();
        this.assertNotCancelledOrDelivered(order);

        const { zone, building } = await this.resolveTarget(ctx, input.zoneId, input.buildingId);
        return this.applyChange(ctx, order, zone, building, input.detail, {
            source: 'admin',
            reason,
            changedBy: (ctx.activeUserId ?? null) as any,
            customerId: ((order.customer as any)?.id ?? null) as any,
        });
    }

    /** 改址差额试算（运营端预览：不写台账、不改订单） */
    async quote(ctx: RequestContext, orderId: ID, zoneId: ID) {
        const order = await this.loadOrder(ctx, orderId);
        if (Number(this.channelIdOf(order, ctx)) !== Number(ctx.channelId)) throw new ForbiddenError();
        this.assertNotCancelledOrDelivered(order);
        const zone = await this.connection.getRepository(ctx, CampusZone).findOne({ where: { id: zoneId as any } });
        if (!zone) throw new UserInputError('分区不存在');
        if (Number((zone as any).channelId) !== Number(ctx.channelId)) throw new ForbiddenError();

        const channelId = this.channelIdOf(order, ctx);
        const cfg = await this.connection.rawConnection.getRepository(CampusFulfillmentConfig).findOne({
            where: { channelId: channelId as any },
        });
        const oldFee = Number(order.shippingWithTax ?? 0);
        const q = await quoteZoneFee(this.connection, channelId, { name: zone.name, fee: Number(zone.fee) }, cfg, order);
        const newFee = Number(q?.price ?? oldFee);
        const buildings = await this.connection
            .getRepository(ctx, CampusBuilding)
            .find({ where: { zoneId: (zone as any).id, channelId: channelId as any } });
        return {
            oldFee,
            newFee,
            diff: newFee - oldFee,
            zoneId: (zone as any).id,
            zoneName: zone.name,
            buildings,
        };
    }

    /** 顾客端：本单最近一次改址（差额状态感知，含已结清） */
    async myLatest(ctx: RequestContext, orderId: ID) {
        if (!ctx.activeUserId) throw new ForbiddenError();
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer) throw new ForbiddenError();
        const order = await this.loadOrder(ctx, orderId);
        if ((order.customer as any)?.id !== customer.id) throw new ForbiddenError();
        const row = await this.connection
            .getRepository(ctx, CampusAddressChange)
            .findOne({ where: { orderId: Number(order.id) }, order: { createdAt: 'DESC' as any } });
        if (!row) return null;
        return {
            id: row.id,
            diff: row.diff,
            status: row.status,
            settleAction: row.settleAction,
            fromZone: row.fromZone,
            fromBuilding: row.fromBuilding,
            toZone: row.toZone,
            toBuilding: row.toBuilding,
            createdAt: row.createdAt,
        };
    }

    /** 动态计价预览：当前供需 + 各分区试算拆解（后台配置页用） */
    async dynamicPreview(ctx: RequestContext) {
        const channelId = ctx.channelId;
        const cfg = await this.connection.rawConnection.getRepository(CampusFulfillmentConfig).findOne({
            where: { channelId: channelId as any },
        });
        const pricing = parseDynamicPricing(cfg?.dynamicPricing ?? null);
        const zones = (await this.connection.rawConnection.getRepository(CampusZone).find({
            where: { channelId: channelId as any },
            order: { id: 'ASC' as any },
        })) as CampusZone[];
        const backlog = pricing.enabled && pricing.supply ? await readHallBacklog(this.connection, channelId) : 0;
        const onlineRiders = (await this.capacity.listOnlineRiders(ctx)).length;
        const now = new Date();
        // 非分区口径：R5 跑腿起步价（未配置按默认 200）、R2 第三方到校基价（未配置不接管）
        const quoteBase = (key: 'errand' | 'third-party', raw: number | null | undefined, fallback: number | null) => {
            const base = raw ?? fallback;
            if (base == null) return null;
            const q = quoteDynamicFee({ baseFee: Number(base), config: pricing, at: now, backlog, onlineRiders });
            return {
                key,
                configured: raw != null,
                baseFee: q.baseFee,
                price: q.price,
                addFee: q.addFee,
                breakdown: q.breakdown,
            };
        };
        return {
            at: now.toISOString(),
            enabled: pricing.enabled,
            backlog,
            onlineRiders,
            manualMultiplier: pricing.manualMultiplier,
            maxAddFee: pricing.maxAddFee,
            errand: quoteBase('errand', cfg?.errandBaseFee, 200),
            thirdParty: quoteBase('third-party', cfg?.thirdPartyBaseFee, null),
            supply: pricing.supply
                ? {
                      backlogThreshold: pricing.supply.backlogThreshold,
                      riderThreshold: pricing.supply.riderThreshold ?? null,
                      addFee: pricing.supply.addFee,
                  }
                : null,
            peakWindows: pricing.peakWindows,
            zones: zones.map(z => {
                const q = quoteDynamicFee({
                    baseFee: Number(z.fee),
                    config: pricing,
                    at: now,
                    backlog,
                    onlineRiders,
                });
                return {
                    zoneId: (z as any).id,
                    zoneName: z.name,
                    baseFee: q.baseFee,
                    price: q.price,
                    addFee: q.addFee,
                    breakdown: q.breakdown,
                };
            }),
        };
    }

    async list(ctx: RequestContext, opts: { status?: string; orderId?: ID; skip?: number; take?: number } = {}) {
        const qb = this.connection
            .getRepository(ctx, CampusAddressChange)
            .createQueryBuilder('r')
            .where('r.channelId = :cid', { cid: ctx.channelId })
            .orderBy('r.createdAt', 'DESC')
            .skip(opts.skip ?? 0)
            .take(Math.min(opts.take ?? 50, 200));
        if (opts.status) qb.andWhere('r.status = :st', { st: opts.status });
        if (opts.orderId != null) qb.andWhere('r.orderId = :oid', { oid: Number(opts.orderId) });
        return qb.getMany();
    }

    async stats(ctx: RequestContext) {
        const rows = await this.connection
            .getRepository(ctx, CampusAddressChange)
            .createQueryBuilder('r')
            .select('r.status', 'status')
            .addSelect('COUNT(*)', 'cnt')
            .addSelect('COALESCE(SUM(CASE WHEN r.diff > 0 THEN r.diff ELSE 0 END), 0)', 'collect')
            .addSelect('COALESCE(SUM(CASE WHEN r.diff < 0 THEN -r.diff ELSE 0 END), 0)', 'refund')
            .where('r.channelId = :cid', { cid: ctx.channelId })
            .groupBy('r.status')
            .getRawMany();
        let pendingCount = 0;
        let pendingCollect = 0;
        let pendingRefund = 0;
        let total = 0;
        for (const r of rows) {
            const cnt = Number(r.cnt) || 0;
            total += cnt;
            if (r.status === 'pending') {
                pendingCount += cnt;
                pendingCollect += Number(r.collect) || 0;
                pendingRefund += Number(r.refund) || 0;
            }
        }
        return {
            total,
            pendingCount,
            pendingCollect,
            pendingRefund,
        };
    }

    /** 运营结清：refund=真实退款 / collect=补收（必须填凭证）/ waive=免收 / pending=撤销结清 */
    async settle(ctx: RequestContext, id: ID, action: string, note?: string) {
        if (!['refund', 'collect', 'waive', 'pending'].includes(action)) {
            throw new UserInputError('无效的结清动作');
        }
        const repo = this.connection.getRepository(ctx, CampusAddressChange);
        const row = await repo.findOne({ where: { id: id as any } });
        if (!row) throw new UserInputError('台账记录不存在');
        if (Number(row.channelId) !== Number(ctx.channelId)) throw new ForbiddenError();
        const trimmed = (note ?? '').trim();
        if (action === 'pending') {
            if (row.refundId) throw new UserInputError('该差额已实际退款，无法撤销结清');
            row.status = 'pending';
            row.settledAt = null;
            row.settledBy = null;
            row.settleAction = null;
            row.settleNote = null;
        } else {
            if (action === 'refund') {
                if (Number(row.diff) >= 0) throw new UserInputError('本单不是待退差额，不能按已退款结清');
                if (row.refundId) throw new UserInputError('该差额已退款，请勿重复操作');
                const amount = Math.abs(Number(row.diff));
                if (amount > 0) {
                    const order = await this.loadOrder(ctx, row.orderId);
                    const refund = await this.refundAmount(
                        ctx,
                        order,
                        amount,
                        `address change refund (${row.orderCode})`,
                    );
                    row.refundId = refund.id as any;
                }
            }
            if (action === 'collect') {
                if (Number(row.diff) <= 0) throw new UserInputError('本单无待补收差额，无需补收');
                if (!trimmed) throw new UserInputError('请填写补收凭证（收款方式或流水号）');
            }
            row.status = 'settled';
            row.settledAt = new Date();
            row.settledBy = (ctx.activeUserId ?? null) as any;
            row.settleAction = action;
            row.settleNote = trimmed || null;
        }
        return repo.save(row);
    }

    /** 部分退款（fork 无 core RefundService，走 OrderService.refundOrder/settleRefund，与 dispatch-admin 同源）。
     * refund 表 shipping/adjustment 列 NOT NULL 必须显式传 0；超额退款抛错。 */
    private async refundAmount(ctx: RequestContext, order: Order, amount: number, reason: string): Promise<Refund> {
        const payment = await this.connection.rawConnection.getRepository(Payment).findOne({
            where: { order: { id: order.id } },
            order: { id: 'DESC' as any },
        });
        if (!payment) throw new UserInputError('订单无支付记录，无法退款');
        const refunded = await this.connection.rawConnection
            .getRepository(Refund)
            .createQueryBuilder('r')
            .select('COALESCE(SUM(r.total), 0)', 'sum')
            .where('r."paymentId" = :pid', { pid: payment.id })
            .getRawOne();
        if (Number(refunded?.sum ?? 0) + amount > Number(payment.amount)) {
            throw new UserInputError('退款金额超过可退余额（订单可能已全额退款）');
        }
        const created: any = await this.orderService.refundOrder(ctx, {
            paymentId: payment.id,
            amount,
            shipping: 0,
            adjustment: 0,
            reason,
        } as any);
        if (!created || created.errorCode) {
            throw new UserInputError(`退款失败：${created?.errorCode ?? '未知原因'}`);
        }
        await this.orderService.settleRefund(ctx, { id: created.id } as any);
        return created as Refund;
    }

    private async loadOrder(ctx: RequestContext, orderId: ID): Promise<Order> {
        const order = await this.connection
            .getRepository(ctx, Order)
            .createQueryBuilder('order')
            .leftJoinAndSelect('order.channels', 'channel')
            .leftJoinAndSelect('order.customer', 'customer')
            .where('order.id = :id', { id: orderId })
            .getOne();
        if (!order) throw new UserInputError('订单不存在');
        return order;
    }

    private assertNotCancelledOrDelivered(order: Order) {
        const cf = (order.customFields ?? {}) as any;
        if (order.state === 'Cancelled') throw new UserInputError('订单已取消，无法改址');
        if (cf.deliveredAt) throw new UserInputError('订单已送达，无法改址');
    }

    private async resolveTarget(ctx: RequestContext, zoneId: ID, buildingId: ID) {
        const zone = await this.connection.getRepository(ctx, CampusZone).findOne({
            where: { id: zoneId as any },
        });
        if (!zone) throw new UserInputError('分区不存在');
        const building = await this.connection.getRepository(ctx, CampusBuilding).findOne({
            where: { id: buildingId as any },
        });
        if (!building) throw new UserInputError('宿舍楼不存在');
        if (Number(building.zoneId) !== Number(zone.id)) throw new UserInputError('楼栋不属于所选分区');
        if (Number((building as any).channelId) !== Number((zone as any).channelId)) throw new UserInputError('楼栋不属于所选分区');
        return { zone, building };
    }

    private async applyChange(
        ctx: RequestContext,
        order: Order,
        zone: CampusZone,
        building: CampusBuilding,
        detail: string | undefined,
        actor: { source: 'customer' | 'admin'; reason: string | null; changedBy: ID | null; customerId: ID | null },
    ) {
        const channelId = this.channelIdOf(order, ctx);
        const cfg = await this.connection.rawConnection.getRepository(CampusFulfillmentConfig).findOne({
            where: { channelId: channelId as any },
        });

        const cf = (order.customFields ?? {}) as any;
        const oldFee = Number(order.shippingWithTax ?? 0);
        const quote = await quoteZoneFee(this.connection, channelId, { name: zone.name, fee: Number(zone.fee) }, cfg, order);
        const newFee = Number(quote?.price ?? oldFee);
        const diff = newFee - oldFee;

        const fromZone = String(cf.campusZone ?? '');
        const fromBuilding = String(cf.buildingId ?? '');
        const fromDetail = cf.deliveryDetail ?? null;
        const toDetail = detail?.trim() || fromDetail;

        const record = await this.connection.getRepository(ctx, CampusAddressChange).save(
            new CampusAddressChange({
                channelId,
                orderId: Number(order.id),
                orderCode: order.code,
                customerId: actor.customerId as any,
                fromZone,
                fromBuilding,
                fromDetail,
                toZone: zone.name,
                toBuilding: building.name,
                toDetail,
                oldFee,
                newFee,
                diff,
                status: diff === 0 ? 'settled' : 'pending',
                settledAt: diff === 0 ? new Date() : null,
                settleAction: diff === 0 ? 'waive' : null,
                source: actor.source,
                reason: actor.reason,
                changedBy: actor.changedBy as any,
            }),
        );

        await this.orderService.updateCustomFields(ctx, order.id, {
            buildingId: String((building as any).id),
            campusZone: zone.name,
            deliveryDetail: toDetail,
        } as any);

        Logger.info(
            `address change [${actor.source}] order=${order.code} ${fromZone}/${fromBuilding} -> ${zone.name}/${building.name} diff=${diff}`,
            loggerCtx,
        );
        // 改址成功通知（fire-and-forget）：以台账记录 id 作幂等后缀，同一订单多次改址各推一条
        this.notify.user(
            ctx,
            order.id,
            'addressChanged',
            `${zone.name}·${building.name}`,
            cfg?.h5BaseUrl ?? undefined,
            String(record.id),
        );
        return {
            diff,
            oldFee,
            newFee,
            fromZone,
            toZone: zone.name,
            recordId: record.id,
        };
    }

    private channelIdOf(order: Order, ctx: RequestContext): ID {
        const channels = (order as any).channels as Array<{ id: ID; code: string }> | undefined;
        const own = (channels ?? []).find(c => c.code !== '__default_channel__');
        return (own?.id ?? ctx.channelId) as ID;
    }
}

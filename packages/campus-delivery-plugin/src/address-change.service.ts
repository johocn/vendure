import { Injectable } from '@nestjs/common';
import {
    CustomerService,
    ForbiddenError,
    ID,
    Logger,
    Order,
    OrderService,
    RequestContext,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';
import { CampusAddressChange } from './campus-address-change.entity';
import { CampusBuilding } from './campus-building.entity';
import { CampusFulfillmentConfig } from './campus-fulfillment-config.entity';
import { CampusZone } from './campus-zone.entity';
import { quoteZoneFee } from './shipping-calculator';

const loggerCtx = 'CampusAddressChange';

/** 外部配送已接单/取货后不可改址 */
const THIRD_PARTY_LOCKED = ['accepted', 'pickup', 'delivered'];

@Injectable()
export class AddressChangeService {
    constructor(
        private connection: TransactionalConnection,
        private orderService: OrderService,
        private customerService: CustomerService,
    ) {}

    /** 顾客自助改址（取货前、可跨分区）。差额不阻塞改址，写入台账待运营结算。 */
    async changeByCustomer(
        ctx: RequestContext,
        input: { orderId: ID; zoneId: ID; buildingId: ID; detail?: string },
    ) {
        if (!ctx.activeUserId) throw new ForbiddenError();
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer) throw new ForbiddenError();

        const order = await this.connection
            .getRepository(ctx, Order)
            .createQueryBuilder('order')
            .leftJoinAndSelect('order.channels', 'channel')
            .leftJoinAndSelect('order.customer', 'customer')
            .where('order.id = :id', { id: input.orderId })
            .getOne();
        if (!order) throw new UserInputError('订单不存在');
        if ((order.customer as any)?.id !== customer.id) throw new ForbiddenError();

        const cf = (order.customFields ?? {}) as any;
        if (order.state === 'Cancelled') throw new UserInputError('订单已取消，无法改址');
        if (cf.deliveredAt) throw new UserInputError('订单已送达，无法改址');
        if (cf.deliveryStatus === 'in_progress') throw new UserInputError('骑手已取货，无法自助改址，请联系客服');
        if (THIRD_PARTY_LOCKED.includes(cf.thirdPartyState)) throw new UserInputError('外部配送已接单，无法自助改址');

        const zone = await this.connection.getRepository(ctx, CampusZone).findOne({
            where: { id: input.zoneId as any },
        });
        if (!zone) throw new UserInputError('分区不存在');
        const building = await this.connection.getRepository(ctx, CampusBuilding).findOne({
            where: { id: input.buildingId as any },
        });
        if (!building) throw new UserInputError('宿舍楼不存在');
        if (Number(building.zoneId) !== Number(zone.id)) throw new UserInputError('楼栋不属于所选分区');

        const channelId = this.channelIdOf(order, ctx);
        const cfg = await this.connection.rawConnection.getRepository(CampusFulfillmentConfig).findOne({
            where: { channelId: channelId as any },
        });

        const oldFee = Number(order.shippingWithTax ?? 0);
        const quote = await quoteZoneFee(this.connection, channelId, { name: zone.name, fee: Number(zone.fee) }, cfg, order);
        const newFee = Number(quote?.price ?? oldFee);
        const diff = newFee - oldFee;

        const fromZone = String(cf.campusZone ?? '');
        const fromBuilding = String(cf.buildingId ?? '');
        const fromDetail = cf.deliveryDetail ?? null;
        const toDetail = input.detail?.trim() || fromDetail;

        const record = await this.connection.getRepository(ctx, CampusAddressChange).save(
            new CampusAddressChange({
                channelId,
                orderId: Number(order.id),
                orderCode: order.code,
                customerId: customer.id,
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
            }),
        );

        await this.orderService.updateCustomFields(ctx, order.id, {
            buildingId: String(building.id),
            campusZone: zone.name,
            deliveryDetail: toDetail,
        } as any);

        Logger.info(
            `address change order=${order.code} ${fromZone}/${fromBuilding} -> ${zone.name}/${building.name} diff=${diff}`,
            loggerCtx,
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

    async list(ctx: RequestContext, opts: { status?: string; skip?: number; take?: number } = {}) {
        const qb = this.connection
            .getRepository(ctx, CampusAddressChange)
            .createQueryBuilder('r')
            .where('r.channelId = :cid', { cid: ctx.channelId })
            .orderBy('r.createdAt', 'DESC')
            .skip(opts.skip ?? 0)
            .take(Math.min(opts.take ?? 50, 200));
        if (opts.status) qb.andWhere('r.status = :st', { st: opts.status });
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

    /** 运营结清：refund=已退顾客 / collect=已补收 / waive=免收 / pending=撤销结清 */
    async settle(ctx: RequestContext, id: ID, action: string) {
        if (!['refund', 'collect', 'waive', 'pending'].includes(action)) {
            throw new UserInputError('无效的结清动作');
        }
        const repo = this.connection.getRepository(ctx, CampusAddressChange);
        const row = await repo.findOne({ where: { id: id as any } });
        if (!row) throw new UserInputError('台账记录不存在');
        if (Number(row.channelId) !== Number(ctx.channelId)) throw new ForbiddenError();
        if (action === 'pending') {
            row.status = 'pending';
            row.settledAt = null;
            row.settledBy = null;
            row.settleAction = null;
        } else {
            row.status = 'settled';
            row.settledAt = new Date();
            row.settledBy = (ctx.activeUserId ?? null) as any;
            row.settleAction = action;
        }
        return repo.save(row);
    }

    private channelIdOf(order: Order, ctx: RequestContext): ID {
        const channels = (order as any).channels as Array<{ id: ID; code: string }> | undefined;
        const own = (channels ?? []).find(c => c.code !== '__default_channel__');
        return (own?.id ?? ctx.channelId) as ID;
    }
}

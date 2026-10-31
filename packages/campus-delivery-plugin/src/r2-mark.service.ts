import { Injectable } from '@nestjs/common';
import { ForbiddenError, ID, Order, OrderService, RequestContext, TransactionalConnection, UserInputError } from '@vendure/core';

/**
 * R2 快递单：外部快递抵达校园交接点（第一程完成）。
 * 权威事实源是外部运单回调（thirdPartyState=delivered 时由回调写入 arrived_gate）；
 * 本接口仅供「快递员已取件但回调滞后/丢失」的兜底确认，因此要求 thirdPartyState 至少为 pickup。
 * 第二段由入厅后校园骑手接力，学生无需再发 R5 跑腿代取（errandFrom 指向 R2 单会被拒绝）。
 * 归属校验：customer.user.id 与 ctx.activeUserId 同为 User 表主键，直接可比。
 */
@Injectable()
export class R2MarkService {
    constructor(private connection: TransactionalConnection, private orderService: OrderService) {}

    /** R2: 学生确认快递已到校 → leg1Status='arrived_gate' + handoverAt */
    async markArrived(ctx: RequestContext, orderId: ID) {
        if (!ctx.activeUserId) throw new ForbiddenError();
        const order = await this.orderService.findOne(ctx, orderId as any, ['customer', 'customer.user'] as any);
        if (!order) throw new UserInputError('订单不存在');
        if ((order as any).customer?.user?.id !== ctx.activeUserId) throw new ForbiddenError();
        if ((order.customFields as any)?.fulfillmentRoute !== 'R2') {
            throw new UserInputError('仅 R2 快递单支持到校确认');
        }
        const leg1 = (order.customFields as any)?.leg1Status as string | null;
        if (leg1 === 'arrived_gate') return { leg1Status: 'arrived_gate' }; // 幂等：不重复写 handoverAt
        if (leg1 != null) throw new UserInputError('当前状态不支持到校确认');
        const tpState = String((order.customFields as any)?.thirdPartyState ?? '');
        // 外部运单已取消/异常：不允许学生端再标到校（否则会出现"运单取消/异常但显示已到校"的假状态）
        if (tpState === 'cancelled') throw new UserInputError('外部运单已取消，请重新下单');
        if (tpState === 'exception') throw new UserInputError('外部运单异常，请重新下单');
        // 未取件（尚未推送/待接单/未取货）时包裹根本不在路上：
        // 学生此时标记到校会误导后续接力配送（骑手到交接点扑空），必须拒绝。
        if (!['pickup', 'delivered'].includes(tpState)) {
            throw new UserInputError('外部运单尚未取件，暂不能确认到校');
        }
        // 条件写：与取消/并发重复提交竞争时只允许一次成功，且不复活已取消单；
        // handoverAt 用 COALESCE 保留外部回调已写入的到校时间（第一段唯一事实源），
        // 避免学生端后点确认把权威时间覆盖成更晚的时间，影响超时/时效口径。
        // thirdPartyState 同步进 CAS：防止校验后运单被取消/回退仍写入 arrived_gate。
        const out: any = await this.connection.rawConnection.query(
            'UPDATE "order" SET "customFieldsLeg1status" = $2, '
            + '"customFieldsHandoverat" = COALESCE("customFieldsHandoverat", $3) '
            + 'WHERE id = $1 AND COALESCE("customFieldsLeg1status", \'\') = \'\' '
            + 'AND COALESCE("customFieldsThirdpartystate", \'\') IN (\'pickup\', \'delivered\') '
            + 'AND "state" <> \'Cancelled\' RETURNING id',
            [order.id, 'arrived_gate', new Date()],
        );
        const rows = Array.isArray(out) && Array.isArray(out[0]) ? out[0] : out;
        if (!Array.isArray(rows) || !rows.length) throw new UserInputError('订单状态已变更，请刷新');
        return { leg1Status: 'arrived_gate' };
    }

    /** R2 原单动态反查接力单：errandFrom=本单 code 的 R5 单，实时读状态、不写回标记（二期 §3.5/§4.3） */
    async relayStatus(ctx: RequestContext, orderId: ID) {
        if (!ctx.activeUserId) throw new ForbiddenError();
        const order = await this.orderService.findOne(ctx, orderId as any, ['customer', 'customer.user'] as any);
        if (!order) throw new UserInputError('订单不存在');
        if ((order as any).customer?.user?.id !== ctx.activeUserId) throw new ForbiddenError();
        const relay = await this.connection.getRepository(ctx, Order).createQueryBuilder('o')
            .leftJoin('o.channels', 'ch')
            .where('ch.id = :chId', { chId: ctx.channelId as any })
            .andWhere('o.customFields.errandFrom = :code', { code: order.code })
            .andWhere('o.customFields.orderKind = :kind', { kind: 'errand' })
            .orderBy('o.id', 'DESC')
            .getOne();
        if (!relay) return null;
        const rcf = (relay.customFields ?? {}) as any;
        return {
            orderId: relay.id,
            orderCode: relay.code,
            state: relay.state,
            hallStatus: rcf.hallStatus ?? null,
            deliveryStatus: rcf.deliveryStatus ?? null,
            errandTo: rcf.errandTo ?? null,
            tip: rcf.tip ?? 0,
            totalWithTax: relay.totalWithTax,
        };
    }
}

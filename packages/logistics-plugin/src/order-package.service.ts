import { Injectable } from '@nestjs/common';
import { ID, Logger, RequestContext, TransactionalConnection } from '@vendure/core';
import { loggerCtx } from './constants';
import { OrderPackage, OrderPackageStatus } from './order-package.entity';
import { SplitLine } from './order-split-plan';

/** 拆单确认时写入的包裹载荷（字段取自 SplitPackage） */
export interface OrderPackageInput {
    packageId: string;
    stockLocationId: ID;
    lines: SplitLine[];
    estimatedShippingFee: number;
    deliveryMode: string;
}

/** 合法流转表：终态（delivered/cancelled）不在任何源态中，天然不可回退 */
const TRANSITIONS: Record<OrderPackageStatus, OrderPackageStatus[]> = {
    pending: ['shipped', 'cancelled'],
    shipped: ['delivered', 'cancelled'],
    delivered: [],
    cancelled: [],
};

@Injectable()
export class OrderPackageService {
    constructor(private connection: TransactionalConnection) {}

    /** 拆单确认：先删后插（幂等，重复确认干净替换），返回落库后的包裹列表 */
    async replaceForOrder(ctx: RequestContext, orderId: ID, packages: OrderPackageInput[]): Promise<OrderPackage[]> {
        const repo = this.connection.getRepository(ctx, OrderPackage);
        await repo.delete({ orderId: orderId as any });
        const entities = packages.map(p =>
            repo.create({
                code: p.packageId,
                orderId,
                stockLocationId: p.stockLocationId,
                linesJson: JSON.stringify(p.lines),
                shippingFee: p.estimatedShippingFee || 0,
                deliveryMode: p.deliveryMode,
                fulfillmentId: null,
                deliveryOrderId: null,
            }),
        );
        await repo.save(entities);
        Logger.info(`order#${orderId} 落库 OrderPackage ${entities.length} 包`, loggerCtx);
        return this.findByOrder(ctx, orderId);
    }

    /** 发货回填：按 orderId + code 匹配包裹，补 fulfillmentId 与实际运费，返回是否命中 */
    async linkFulfillment(
        ctx: RequestContext,
        orderId: ID,
        packageId: string,
        fulfillmentId: ID,
        actualShippingFee: number | null,
    ): Promise<boolean> {
        const repo = this.connection.getRepository(ctx, OrderPackage);
        const pkg = await repo.findOne({ where: { orderId: orderId as any, code: packageId } as any });
        if (!pkg) {
            Logger.warn(`OrderPackage 未命中 order#${orderId} pkg=${packageId}，跳过发货回填`, loggerCtx);
            return false;
        }
        pkg.fulfillmentId = fulfillmentId;
        if (actualShippingFee != null) {
            pkg.shippingFee = actualShippingFee;
        }
        await repo.save(pkg);
        return true;
    }

    /** 配送关联：按 orderId + code 匹配包裹，回填 deliveryOrderId，返回是否命中 */
    async linkDeliveryOrder(ctx: RequestContext, orderId: ID, packageId: string, deliveryOrderId: ID): Promise<boolean> {
        const repo = this.connection.getRepository(ctx, OrderPackage);
        const pkg = await repo.findOne({ where: { orderId: orderId as any, code: packageId } as any });
        if (!pkg) {
            Logger.warn(`OrderPackage 未命中 order#${orderId} pkg=${packageId}，跳过配送关联`, loggerCtx);
            return false;
        }
        pkg.deliveryOrderId = deliveryOrderId;
        await repo.save(pkg);
        return true;
    }

    /** 订单级包裹查询（按包号排序） */
    async findByOrder(ctx: RequestContext, orderId: ID): Promise<OrderPackage[]> {
        return this.connection.getRepository(ctx, OrderPackage).find({
            where: { orderId: orderId as any },
            order: { code: 'ASC' } as any,
        });
    }

    /** 状态流转：幂等（同状态返回 true）、非法流转告警忽略、未命中告警返回 false；不抛错不阻断主链路 */
    async transition(ctx: RequestContext, orderId: ID, packageId: string, toStatus: OrderPackageStatus): Promise<boolean> {
        const repo = this.connection.getRepository(ctx, OrderPackage);
        const pkg = await repo.findOne({ where: { orderId: orderId as any, code: packageId } as any });
        if (!pkg) {
            Logger.warn(`OrderPackage 未命中 order#${orderId} pkg=${packageId}，跳过状态流转 ${toStatus}`, loggerCtx);
            return false;
        }
        if (pkg.status === toStatus) {
            return true; // 幂等
        }
        if (!TRANSITIONS[pkg.status].includes(toStatus)) {
            Logger.warn(`非法包裹状态流转 ${pkg.status}->${toStatus}（order#${orderId} pkg=${packageId}），忽略`, loggerCtx);
            return false;
        }
        pkg.status = toStatus;
        if (toStatus === 'shipped') pkg.shippedAt = new Date();
        if (toStatus === 'delivered') pkg.deliveredAt = new Date();
        if (toStatus === 'cancelled') pkg.cancelledAt = new Date();
        await repo.save(pkg);
        Logger.info(`OrderPackage order#${orderId} pkg=${packageId} -> ${toStatus}`, loggerCtx);
        return true;
    }
}

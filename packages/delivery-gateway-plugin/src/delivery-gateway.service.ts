import { Injectable } from '@nestjs/common';
import { Injector, ID, Logger, RequestContext, TransactionalConnection } from '@vendure/core';
import { DeliveryOrder } from './delivery-order.entity';
import { DeliveryProvider, DeliveryStatus, DeliveryStatusEvent } from './delivery-provider';
import { loggerCtx } from './constants';

const TRANSITIONS: Record<DeliveryStatus, DeliveryStatus[]> = {
    pending: ['accepted', 'cancelled', 'exception'],
    accepted: ['pickup', 'cancelled', 'exception'],
    pickup: ['delivered', 'cancelled', 'exception'],
    delivered: [],
    cancelled: [],
    exception: ['cancelled'],
};

@Injectable()
export class DeliveryGatewayService {
    private injector!: Injector;
    private connection!: TransactionalConnection;
    private providers = new Map<string, DeliveryProvider>();
    /** 可选：logistics-plugin 注册的 OrderPackageLinker（OrderPackageService），用于按包回填配送单 + 状态回写 */
    private orderPackageLinker: {
        linkDeliveryOrder(ctx: any, orderId: ID, packageId: string, deliveryOrderId: ID): Promise<boolean>;
        transition(ctx: any, orderId: ID, packageId: string, toStatus: 'shipped' | 'delivered' | 'cancelled'): Promise<boolean>;
    } | null = null;

    init(injector: Injector): void {
        this.injector = injector;
        this.connection = injector.get(TransactionalConnection);
        try {
            // 字符串 token + duck-typing：不引入对 @vendure/logistics-plugin 的编译依赖
            this.orderPackageLinker = injector.get('OrderPackageLinker');
        } catch {
            this.orderPackageLinker = null;
        }
    }

    registerProvider(provider: DeliveryProvider): void {
        this.providers.set(provider.code, provider);
        Logger.info(`同城配送 Provider 注册: ${provider.code}(${provider.name})`, loggerCtx);
    }

    getProvider(code: string): DeliveryProvider | undefined {
        return this.providers.get(code);
    }

    async createDelivery(
        ctx: RequestContext,
        input: { orderId: ID; packageId: string; providerCode: string; pickup: any; dropoff: any; items: any[]; remark?: string },
    ): Promise<DeliveryOrder> {
        const provider = this.getProvider(input.providerCode);
        if (!provider) {
            throw new Error(`未注册的配送商: ${input.providerCode}`);
        }
        const result = await provider.createDelivery(ctx, {
            orderId: input.orderId,
            packageId: input.packageId,
            pickup: input.pickup,
            dropoff: input.dropoff,
            items: input.items,
            deliveryType: 'instant',
            remark: input.remark,
        });
        const entity = this.connection.getRepository(ctx, DeliveryOrder).create({
            // 必须用 Provider 返回的单号，applyStatusEvent 按 code 定位配送单
            code: result.deliveryOrderNo,
            orderId: input.orderId,
            packageId: input.packageId,
            fulfillmentId: null,
            providerCode: input.providerCode,
            thirdPartyNo: result.thirdPartyNo,
            status: result.status,
            pickupJson: JSON.stringify(input.pickup),
            dropoffJson: JSON.stringify(input.dropoff),
            itemsJson: JSON.stringify(input.items),
            fee: result.fee,
        });
        await this.connection.getRepository(ctx, DeliveryOrder).save(entity);
        // 挂钩点3：按 orderId + packageId 回填 OrderPackage.deliveryOrderId（未命中仅告警，不阻断）
        if (this.orderPackageLinker) {
            try {
                await this.orderPackageLinker.linkDeliveryOrder(ctx, input.orderId, input.packageId, entity.id);
            } catch (e: any) {
                Logger.warn(`OrderPackage 关联配送单失败 order#${input.orderId} pkg=${input.packageId}: ${e?.message ?? e}`, loggerCtx);
            }
        }
        // 挂钩点3b：同城下单即视为发货 → OrderPackage pending→shipped（未命中仅告警，不阻断）
        if (this.orderPackageLinker) {
            try {
                await this.orderPackageLinker.transition(ctx, input.orderId, input.packageId, 'shipped');
            } catch (e: any) {
                Logger.warn(`OrderPackage 状态置 shipped 失败 order#${input.orderId} pkg=${input.packageId}: ${e?.message ?? e}`, loggerCtx);
            }
        }
        return entity;
    }

    /** 按订单查询配送单列表（新建在前） */
    async findByOrder(ctx: RequestContext, orderId: ID): Promise<DeliveryOrder[]> {
        return this.connection.getRepository(ctx, DeliveryOrder).find({
            where: { orderId: orderId as any },
            order: { createdAt: 'ASC' as any },
        });
    }

    /** 处理平台回写（webhook 或 Mock 模拟），驱动状态机 */
    async applyStatusEvent(ctx: RequestContext, event: DeliveryStatusEvent): Promise<DeliveryOrder> {
        const repo = this.connection.getRepository(ctx, DeliveryOrder);
        const delivery = await repo.findOne({
            where: { code: event.deliveryOrderNo } as any,
        });
        if (!delivery) {
            throw new Error(`配送单不存在: ${event.deliveryOrderNo}`);
        }
        const allowed = TRANSITIONS[delivery.status];
        if (!allowed.includes(event.status)) {
            Logger.warn(`非法配送状态流转 ${delivery.status}->${event.status}，忽略`, loggerCtx);
            return delivery;
        }
        delivery.status = event.status;
        delivery.courierName = event.courierName ?? delivery.courierName;
        delivery.courierPhone = event.courierPhone ?? delivery.courierPhone;
        delivery.reason = event.reason ?? delivery.reason;
        if (event.status === 'accepted') delivery.acceptedAt = new Date();
        if (event.status === 'pickup') delivery.pickupAt = new Date();
        if (event.status === 'delivered') delivery.deliveredAt = new Date();
        if (event.status === 'cancelled') delivery.cancelledAt = new Date();
        await repo.save(delivery);
        // 挂钩点3c：配送终态（delivered/cancelled）回写 OrderPackage（未命中仅告警，不阻断）
        if ((event.status === 'delivered' || event.status === 'cancelled') && this.orderPackageLinker && delivery.packageId) {
            try {
                await this.orderPackageLinker.transition(ctx, delivery.orderId, delivery.packageId, event.status);
            } catch (e: any) {
                Logger.warn(`OrderPackage 状态回写失败 ${delivery.code}: ${e?.message ?? e}`, loggerCtx);
            }
        }
        Logger.info(`配送单 ${delivery.code} -> ${event.status}`, loggerCtx);
        return delivery;
    }

    /** 供 C端 Shop API 查询：返回配送单骑手信息（仅公开字段） */
    async getShopDelivery(
        ctx: RequestContext,
        deliveryOrderId: ID,
    ): Promise<{
        courierName: string | null;
        courierPhone: string | null;
        thirdPartyNo: string | null;
        etaMinutes: number | null;
    } | null> {
        const repo = this.connection.getRepository(ctx, DeliveryOrder);
        const delivery = await repo.findOne({ where: { id: deliveryOrderId } });
        if (!delivery) {
            return null;
        }
        return {
            courierName: delivery.courierName ?? null,
            courierPhone: delivery.courierPhone ?? null,
            thirdPartyNo: delivery.thirdPartyNo ?? null,
            etaMinutes: delivery.etaMinutes ?? null,
        };
    }
}

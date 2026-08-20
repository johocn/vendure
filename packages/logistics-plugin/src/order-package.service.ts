import { Injectable } from '@nestjs/common';
import {
    EntityNotFoundError,
    ForbiddenError,
    ID,
    Injector,
    isGraphQlErrorResult,
    Logger,
    Order,
    OrderLine,
    OrderService,
    RequestContext,
    TransactionalConnection,
    UnauthorizedError,
} from '@vendure/core';
import { In } from 'typeorm';
import { loggerCtx } from './constants';
import { OrderPackage, OrderPackageStatus } from './order-package.entity';
import { LogisticsTrack } from './logistics-track.entity';
import { SplitLine } from './order-split-plan';

/** C端 Shop 查询接口：经 duck-typing 零依赖获取配送单骑手信息 */
interface DeliveryOrderShopLinker {
    getShopDelivery(ctx: RequestContext, deliveryOrderId: ID): Promise<{
        courierName: string | null;
        courierPhone: string | null;
        thirdPartyNo: string | null;
        etaMinutes: number | null;
    } | null>;
}

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
    private injector: Injector | null = null;
    private orderService: OrderService | null = null;
    private deliveryShopLinker: DeliveryOrderShopLinker | null = null;

    constructor(private connection: TransactionalConnection) {}

    /** 由 LogisticsPlugin.onApplicationBootstrap 调用，注入器就绪后解析可选依赖 */
    init(injector: Injector): void {
        this.injector = injector;
        try {
            this.orderService = this.injector.get(OrderService);
        } catch (e) {
            Logger.warn('OrderPackageService 无法获取 OrderService，getMyOrderPackages 将不可用', loggerCtx);
            this.orderService = null;
        }
        try {
            // duck-typing：delivery-gateway-plugin 可选提供（零编译依赖）
            this.deliveryShopLinker = this.injector.get('DeliveryOrderShopLinker') as any;
        } catch (e) {
            Logger.warn('DeliveryOrderShopLinker 未找到，city 包骑手信息将不可用', loggerCtx);
            this.deliveryShopLinker = null;
        }
    }

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

    /**
     * 同步重算拆单运费：拆单确认后调用，确保 shippingWithTax 在支付前已落定。
     * 否则仅依赖 ArrangingPayment 过渡的异步 recalcSplitShipping，支付时总额可能漏计运费
     * → checkPaymentsCoverTotal 失败、订单滞留 ArrangingPayment。
     */
    async finalizeSplitShipping(ctx: RequestContext, orderId: ID): Promise<void> {
        if (!this.orderService) {
            return;
        }
        const order = await this.orderService.findOne(ctx, orderId);
        if (!order || !(order.shippingLines?.length)) {
            return;
        }
        const hasSplit = (order.lines ?? []).some((line: OrderLine & { customFields?: any }) => {
            const raw = (line.customFields as any)?.stockLocationsJson;
            if (!raw) {
                return false;
            }
            try {
                const arr = JSON.parse(String(raw));
                return Array.isArray(arr) && arr.length > 0;
            } catch {
                return false;
            }
        });
        if (!hasSplit) {
            return;
        }
        const updated = await this.orderService.applyPriceAdjustments(ctx, order);
        await this.connection.getRepository(ctx, Order).save(updated, { reload: false });
        Logger.info(`拆单确认后同步重算运费 order#${order.code ?? orderId} -> shippingWithTax=${updated.shippingWithTax}`, loggerCtx);
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

    /** 按订单+包号查询单个包裹（供 batchCreateFulfillment 按包行过滤复用） */
    async findByOrderAndCode(ctx: RequestContext, orderId: ID, code: string): Promise<OrderPackage | null> {
        return this.connection.getRepository(ctx, OrderPackage).findOne({
            where: { orderId: orderId as any, code } as any,
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
        // 履约闭环：包裹状态变化后镜像 self 包 fulfillment（core 一致性）+ 聚合驱动订单状态（失败仅告警，不阻断）
        if (toStatus === 'shipped' || toStatus === 'delivered') {
            await this.mirrorFulfillment(ctx, pkg, toStatus);
        }
        try {
            await this.reconcileOrderState(ctx, orderId);
        } catch (e: any) {
            Logger.warn(`订单状态聚合失败 order#${orderId}: ${e?.message ?? e}`, loggerCtx);
        }
        return true;
    }

    /**
     * 履约闭环核心：按包裹生命周期聚合推导订单目标状态并推进。
     * 幂等（订单已到目标状态跳过）、非法流转经 getNextOrderStates 二次过滤仅告警。
     */
    async reconcileOrderState(ctx: RequestContext, orderId: ID): Promise<void> {
        if (!this.orderService) {
            Logger.warn('OrderService 未初始化，跳过订单状态聚合', loggerCtx);
            return;
        }
        const packages = await this.findByOrder(ctx, orderId);
        const hasPending = packages.some(p => p.status === 'pending');
        const shippedCount = packages.filter(p => p.status === 'shipped').length;
        const deliveredCount = packages.filter(p => p.status === 'delivered').length;

        let target: string | null = null;
        if (deliveredCount > 0 && packages.every(p => p.status === 'delivered')) {
            target = 'Delivered'; // 全部送达
        } else if (deliveredCount > 0) {
            target = 'PartiallyDelivered'; // 部分送达
        } else if (!hasPending && shippedCount > 0 && packages.every(p => p.status !== 'pending')) {
            target = 'Shipped'; // 全部发货（含 cancelled）
        } else if (shippedCount > 0) {
            target = 'PartiallyShipped'; // 部分发货
        }
        // 全部 cancelled：不推进（订单级取消是独立语义，已发货/送达包取消走售后）
        if (!target) return;

        const order = await this.orderService.findOne(ctx, orderId);
        if (!order) return;
        // 订单已到目标态：无需重复推进，但需补写首次送达基准 fda——
        // self 包有 fulfillment，核心 fulfillment 流程（不依赖本 reconcile）会把订单推到
        // Delivered，此时若直接 return 会漏写 markDeliveredAt（t5/t8pre FAIL 根因）。
        if (order.state === target) {
            if (target === 'Delivered') {
                await this.markDeliveredAt(ctx, orderId);
            }
            return;
        }
        const next = this.orderService.getNextOrderStates(order);
        if (!next.includes(target as any)) {
            Logger.warn(
                `订单聚合目标 ${target} 不在可达状态 [${next.join(',')}]（order#${orderId} 当前 ${order.state}），跳过`,
                loggerCtx,
            );
            return;
        }
        const result = await this.orderService.transitionToState(ctx, orderId, target as any);
        if (isGraphQlErrorResult(result)) {
            Logger.warn(`订单状态流转 ${order.state}->${target} 失败: ${JSON.stringify(result)}`, loggerCtx);
            return;
        }
        if (target === 'Delivered') {
            await this.markDeliveredAt(ctx, orderId); // 首次送达写 fulfillmentDeliveredAt（自动完成扫描基准）
        }
        Logger.info(`订单聚合回写 order#${orderId} -> ${target}`, loggerCtx);
    }

    /** 订单首次进入 Delivered 时写 fulfillmentDeliveredAt（自动交易完成的扫描基准；已写过则跳过） */
    async markDeliveredAt(ctx: RequestContext, orderId: ID): Promise<void> {
        if (!this.orderService) return;
        const order = await this.orderService.findOne(ctx, orderId);
        if (!order || (order.customFields as any)?.fulfillmentDeliveredAt) return;
        // 用 updateCustomFields（patchEntity 生成新对象）而非就地改 customFields：
        // 就地修改同一对象引用 TypeORM 变更检测不识别（identity map 快照指向同一对象），UPDATE 会被跳过
        await this.orderService.updateCustomFields(ctx, orderId, { fulfillmentDeliveredAt: new Date() });
    }

    /** self 包 fulfillment 镜像：包裹 shipped/delivered 时同步 fulfillment 状态（core 一致性，失败仅告警） */
    async mirrorFulfillment(
        ctx: RequestContext,
        pkg: OrderPackage,
        toStatus: 'shipped' | 'delivered',
    ): Promise<void> {
        if (pkg.fulfillmentId == null || !this.orderService) return;
        const target = toStatus === 'shipped' ? 'Shipped' : 'Delivered';
        try {
            const res = await this.orderService.transitionFulfillmentToState(ctx, pkg.fulfillmentId, target as any);
            if (isGraphQlErrorResult(res)) {
                Logger.warn(`fulfillment#${pkg.fulfillmentId} 镜像 ${target} 失败: ${JSON.stringify(res)}`, loggerCtx);
            }
        } catch (e: any) {
            Logger.warn(`fulfillment#${pkg.fulfillmentId} 镜像 ${target} 异常: ${e?.message ?? e}`, loggerCtx);
        }
    }

    /**
     * C端确认收货：归属校验（customer.user.id === activeUserId）+ Delivered → Completed（幂等）。
     * 复用阶段7 的归属校验模式：ctx.activeUserId 是登录 User 主键，而 Order.customer.id 是 Customer 主键，两者不同。
     */
    async confirmOrderReceipt(ctx: RequestContext, orderId: ID): Promise<boolean> {
        if (!this.orderService) {
            throw new Error('OrderService 未初始化');
        }
        if (!ctx.activeUserId) {
            throw new UnauthorizedError();
        }
        const order = await this.orderService.findOne(ctx, orderId, ['customer', 'customer.user']);
        if (!order) {
            throw new EntityNotFoundError('Order', orderId);
        }
        const customerUserId = (order.customer as any)?.user?.id;
        if (!order.customer || customerUserId == null || String(customerUserId) !== String(ctx.activeUserId)) {
            throw new ForbiddenError();
        }
        if (order.state === 'Completed') return true; // 幂等
        if (order.state !== 'Delivered') {
            Logger.warn(`确认收货要求订单在 Delivered（当前 ${order.state}），跳过`, loggerCtx);
            return false;
        }
        const result = await this.orderService.transitionToState(ctx, orderId, 'Completed' as any);
        return !isGraphQlErrorResult(result);
    }

    /** C端查询：本人订单包裹列表（按包号排序），返回可直接渲染的富化结果 */
    async getMyOrderPackages(
        ctx: RequestContext,
        orderId: ID,
    ): Promise<Array<{
        code: string;
        deliveryMode: string;
        status: string;
        shippedAt: Date | null;
        deliveredAt: Date | null;
        cancelledAt: Date | null;
        shippingFee: number | null;
        lines: Array<{
            orderLineId: ID;
            quantity: number;
            productName: string;
            sku: string;
        }>;
        trackingNo: string | null;
        carrierName: string | null;
        courierName: string | null;
        courierPhone: string | null;
        thirdPartyNo: string | null;
        etaMinutes: number | null;
    }>> {
        // 1. 归属校验
        if (!this.orderService) {
            throw new Error('OrderService 未初始化');
        }
        if (!ctx.activeUserId) {
            throw new UnauthorizedError();
        }
        const order = await this.orderService.findOne(ctx, orderId, ['customer', 'customer.user']);
        if (!order) {
            throw new EntityNotFoundError('Order', orderId);
        }
        // 注意：order.customer.id 是 Customer 主键，而 ctx.activeUserId 是关联 User 主键，两者不同。
        // 归属校验必须基于 customer.user.id 与 activeUserId 比较。
        const customerUserId = (order.customer as any)?.user?.id;
        if (!order.customer || customerUserId == null || String(customerUserId) !== String(ctx.activeUserId)) {
            throw new ForbiddenError();
        }

        // 2. 取包裹列表（已按 code 排序）
        const packages = await this.findByOrder(ctx, orderId);

        // 3. 解析 linesJson，收集 lineIds 用于富化
        const allLineIds: ID[] = [];
        const linesByPackage: Array<SplitLine[]> = [];
        for (const pkg of packages) {
            let lines: SplitLine[] = [];
            if (pkg.linesJson) {
                try {
                    lines = JSON.parse(pkg.linesJson) as SplitLine[];
                } catch (e) {
                    Logger.warn(`order#${orderId} pkg=${pkg.code} linesJson 解析失败`, loggerCtx);
                }
            }
            linesByPackage.push(lines);
            allLineIds.push(...lines.map(l => l.orderLineId));
        }

        // 4. 富化：join OrderLine → variant → product → translations 取 productName/sku
        const lineMap = new Map<ID, { productName: string; sku: string }>();
        if (allLineIds.length > 0) {
            const orderLines = await this.connection.getRepository(ctx, OrderLine).find({
                where: { id: In(allLineIds) },
                relations: ['productVariant', 'productVariant.product', 'productVariant.product.translations'],
            });
            for (const line of orderLines) {
                const translation = line.productVariant.product.translations.find(
                    t => t.languageCode === ctx.languageCode,
                );
                const productName = translation?.name ?? '(未知)';
                lineMap.set(line.id, { productName, sku: line.productVariant.sku });
            }
        }

        // 5. 若有 self 物流，加载 LogisticsTrack 映射 trackingNo/carrierName
        //    注：LogisticsTrack 实体无 carrierName 列，resolver 约定以 carrierCode 作为展示名（同 logistics-shop.resolver.ts）
        const fulfillmentIds = packages
            .map(p => p.fulfillmentId)
            .filter((id): id is ID => id != null);
        const trackMap = new Map<ID, { trackingNo: string; carrierName: string }>();
        if (fulfillmentIds.length > 0) {
            const repo = this.connection.getRepository(ctx, LogisticsTrack);
            const tracks = await repo.find({ where: { fulfillmentId: In(fulfillmentIds as any) } });
            for (const track of tracks) {
                trackMap.set(track.fulfillmentId, {
                    trackingNo: track.trackingNo,
                    carrierName: track.carrierCode,
                });
            }
        }

        // 6. 若有 city 配送，经 linker 获取骑手信息（linker 可选）
        const deliveryMap = new Map<ID, Awaited<ReturnType<NonNullable<DeliveryOrderShopLinker>['getShopDelivery']>>>();
        const deliveryIds = packages
            .map(p => p.deliveryOrderId)
            .filter((id): id is ID => id != null);
        if (deliveryIds.length > 0 && this.deliveryShopLinker) {
            for (const deliveryId of deliveryIds) {
                const info = await this.deliveryShopLinker.getShopDelivery(ctx, deliveryId);
                deliveryMap.set(deliveryId, info);
            }
        }

        // 7. 组装返回结果
        const result = await Promise.all(packages.map(async (pkg, idx) => {
            const lines = linesByPackage[idx];
            const richLines = lines.map(line => {
                const rich = lineMap.get(line.orderLineId);
                return {
                    orderLineId: line.orderLineId,
                    quantity: line.quantity,
                    productName: rich?.productName ?? '(未知)',
                    sku: rich?.sku ?? '',
                };
            });
            const track = pkg.fulfillmentId ? trackMap.get(pkg.fulfillmentId) : null;
            const delivery = pkg.deliveryOrderId ? deliveryMap.get(pkg.deliveryOrderId) : null;
            return {
                code: pkg.code,
                deliveryMode: pkg.deliveryMode,
                status: pkg.status,
                shippedAt: pkg.shippedAt,
                deliveredAt: pkg.deliveredAt,
                cancelledAt: pkg.cancelledAt,
                shippingFee: pkg.shippingFee,
                lines: richLines,
                trackingNo: track?.trackingNo ?? null,
                carrierName: track?.carrierName ?? null,
                courierName: delivery?.courierName ?? null,
                courierPhone: delivery?.courierPhone ?? null,
                thirdPartyNo: delivery?.thirdPartyNo ?? null,
                etaMinutes: delivery?.etaMinutes ?? null,
            };
        }));

        return result;
    }
}

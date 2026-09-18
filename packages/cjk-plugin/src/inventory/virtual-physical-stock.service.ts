import { Injectable } from '@nestjs/common';
import {
    EventBus,
    ID,
    Logger,
    Order,
    RequestContext,
    StockLevelService,
    StockLocation,
    StockLocationService,
    StockMovementEvent,
    TransactionalConnection,
} from '@vendure/core';
import { Sale } from '@vendure/core';
import { InventoryService } from '@vendure/inventory-plugin';
import { In } from 'typeorm';
import { VariantLocationBinding } from './variant-location-binding.entity';
import { calcMirrorDelta, haversineKm, sumBoundOnHand } from './mirror-math';
import { pinByCity } from './stock-city-filter';
import { filterLocationsByDelivery } from './delivery-methods';
import { DeliveryRecordService } from '../delivery/delivery-record.service';

const loggerCtx = 'VirtualPhysicalStockService';

@Injectable()
export class VirtualPhysicalStockService {
    constructor(
        private connection: TransactionalConnection,
        private stockLocationService: StockLocationService,
        private stockLevelService: StockLevelService,
        private inventoryService: InventoryService,
        private eventBus: EventBus,
        private deliveryRecordService: DeliveryRecordService,
    ) {}

    virtualCode(channelCode: string): string {
        return `${channelCode}-virtual`;
    }

    async ensureVirtualLocation(ctx: RequestContext): Promise<StockLocation> {
        const code = this.virtualCode(ctx.channel.code);
        const repo = this.connection.getRepository(ctx, StockLocation);
        const existing = await repo
            .createQueryBuilder('loc')
            .where('loc.customFields.code = :code', { code })
            .getOne();
        if (existing) {
            return existing;
        }
        const loc = await this.stockLocationService.create(ctx, {
            name: `${ctx.channel.code} 虚拟仓`,
            description: '网络销售可售源（系统自动创建）',
        });
        loc.customFields = { ...((loc.customFields as any) ?? {}), kind: 'virtual', code } as any;
        await repo.save(loc);
        Logger.info(`虚拟仓已创建: ${code}`, loggerCtx);
        return loc;
    }

    async ensureDefaultPhysicalLocation(ctx: RequestContext): Promise<StockLocation> {
        const code = ctx.channel.code;
        const repo = this.connection.getRepository(ctx, StockLocation);
        const existing = await repo
            .createQueryBuilder('loc')
            .where('loc.customFields.code = :code', { code })
            .getOne();
        if (existing) {
            return existing;
        }
        const loc = await this.stockLocationService.create(ctx, {
            name: `${ctx.channel.code} 默认仓`,
            description: '物理库存默认仓（开启物理库存时自动创建）',
        });
        loc.customFields = { ...((loc.customFields as any) ?? {}), kind: 'physical', code } as any;
        await repo.save(loc);
        Logger.info(`默认物理仓已创建: ${code}`, loggerCtx);
        return loc;
    }

    /** 替换式写入变体绑定；校验每个仓为物理仓且归属当前租户 */
    async setVariantBindings(
        ctx: RequestContext,
        variantId: ID,
        bindings: Array<{ locationId: ID; isDefault: boolean }>,
    ): Promise<VariantLocationBinding[]> {
        const repo = this.connection.getRepository(ctx, VariantLocationBinding);
        await repo.delete({ variantId: variantId as any });
        const saved: VariantLocationBinding[] = [];
        for (const b of bindings) {
            const loc = await this.connection.getEntityOrThrow(ctx, StockLocation, b.locationId);
            const kind = (loc.customFields as any)?.kind;
            if (kind !== 'physical') {
                throw new Error(`仓库 ${b.locationId} 非物理仓，无法绑定`);
            }
            const ownerCode = String((loc.customFields as any)?.code ?? '');
            if (ownerCode !== ctx.channel.code && !ownerCode.startsWith(`${ctx.channel.code}-`)) {
                throw new Error(`仓库 ${b.locationId} 不属于当前租户`);
            }
            const savedBinding = await repo.save(
                new VariantLocationBinding({ variantId, locationId: b.locationId, isDefault: b.isDefault }),
            );
            saved.push(savedBinding);
        }
        return saved;
    }

    /** SALE 后镜像：物理驱动变体的虚拟仓 onHand 同步为 Σ 绑定物理仓 onHand（同事务） */
    async syncVirtualMirror(ctx: RequestContext, sales: Sale[]): Promise<void> {
        if (!sales?.length) {
            return;
        }
        const virtual = await this.ensureVirtualLocation(ctx);
        const variantIds = [...new Set(sales.map(s => String((s as any).productVariantId ?? (s as any).productVariant?.id)))];
        const bindingRepo = this.connection.getRepository(ctx, VariantLocationBinding);
        for (const variantId of variantIds) {
            const bindings = await bindingRepo.find({ where: { variantId: variantId as any } });
            if (!bindings.length) {
                continue;
            }
            const boundIds = bindings.map(b => b.locationId);
            const levels = await this.stockLevelService.getStockLevelsForVariant(ctx, variantId as ID);
            const boundTotal = sumBoundOnHand(
                levels.map(l => ({ locationId: l.stockLocationId, onHand: l.stockOnHand })),
                boundIds,
            );
            const currentVirtual =
                levels.find(l => String(l.stockLocationId) === String(virtual.id))?.stockOnHand ?? 0;
            const delta = calcMirrorDelta(currentVirtual, boundTotal);
            if (delta === 0) {
                continue;
            }
            await this.inventoryService.adjustStockPublic(
                ctx,
                variantId as ID,
                virtual.id,
                delta,
                `虚拟镜像同步(variant=${variantId})`,
                { bizType: 'mirror', bizCode: `mirror-${variantId}` },
            );
            Logger.info(`镜像同步: variant=${variantId} 虚拟仓 ${currentVirtual} -> ${boundTotal}`, loggerCtx);
        }
    }

    /** 注册 SALE 阻塞处理器（镜像必须在 core 扣库同一事务内执行；配送记录同步同事务防漏单） */
    registerMirrorHandler(): void {
        this.eventBus.registerBlockingEventHandler({
            event: StockMovementEvent,
            id: 'cjk-plugin.sync-virtual-mirror',
            handler: event => {
                if (event.type === 'SALE') {
                    const sales = event.stockMovements as Sale[];
                    return this.syncVirtualMirror(event.ctx, sales).then(async () => {
                        await this.syncDeliveryRecords(event.ctx, sales);
                    });
                }
                return undefined;
            },
        });
    }

    /** SALE 后生成顾客配送记录（方案2-B）；pickup 订单标记自提模式 */
    async syncDeliveryRecords(ctx: RequestContext, sales: Sale[]): Promise<void> {
        const records = await this.deliveryRecordService.createFromSales(ctx, sales);
        if (!records.length) {
            return;
        }
        // pickup 订单：按订单级配送方式重设模式
        const orderIds = [...new Set(records.map(r => String(r.orderId)))];
        const orderRepo = this.connection.getRepository(ctx, Order);
        const orders = await orderRepo.find({ where: { id: In(orderIds) } });
        for (const order of orders) {
            const c = (order.customFields as any) ?? {};
            if (c.deliveryType === 'pickup' && c.selectedPickupLocationId) {
                for (const rec of records.filter(r => String(r.orderId) === String(order.id))) {
                    await this.deliveryRecordService.markAsPickup(ctx, rec.id, c.selectedPickupLocationId);
                }
            }
        }
    }

    /** 店铺端：saleableStock（虚拟仓可售）+ 物理驱动时的绑定仓明细（距离就近排序） */
    async getSaleableAndDetail(
        ctx: RequestContext,
        variantId: ID,
        lat?: number | null,
        lng?: number | null,
        city?: string | null,
        deliveryMethod?: 'MAIL' | 'SELF_PICKUP' | null,
    ) {
        const levels = await this.stockLevelService.getStockLevelsForVariant(ctx, variantId);
        const physicalStockEnabled = Boolean((ctx.channel.customFields as any)?.physicalStockEnabled);
        const bindings = await this.connection
            .getRepository(ctx, VariantLocationBinding)
            .find({ where: { variantId: variantId as any } });
        // 虚拟可售源：汇总该变体在本渠道下所有 kind=virtual 仓的 onHand。
        // 旧实现只取 code=<channel>-virtual 的单一自动仓，会漏掉无 customFields.code 的「默认仓」类
        // 虚拟仓里的真实库存，导致无物理绑定时 saleableStock 恒为 0、线上显示「无货」（回归）。
        // 绑定物理仓的变体仍走下方物理路径不受影响。
        const vc = this.virtualCode(ctx.channel.code);
        const virtualIds = new Set(
            (await this.connection.getRepository(ctx, StockLocation).find({ loadEagerRelations: false }))
                .filter(l => {
                    const cf = (l.customFields as any) ?? {};
                    if (cf.kind !== 'virtual') return false;
                    const code = String(cf.code ?? '');
                    return !code || code === vc;
                })
                .map(l => String(l.id)),
        );
        const virtualOnHand = levels
            .filter(l => virtualIds.has(String(l.stockLocationId)))
            .reduce((s, l) => s + (l.stockOnHand ?? 0), 0);

        let stockDetail: any[] = [];
        let saleableStock = virtualOnHand;
        if (physicalStockEnabled && bindings.length) {
            const boundIds = bindings.map(b => b.locationId);
            const locs = await this.connection
                .getRepository(ctx, StockLocation)
                .find({ where: { id: In(boundIds) }, loadEagerRelations: false });
            const origin = lat != null && lng != null ? { lat, lng } : null;

            // 配送口径：自提=可自提点、邮寄=可发仓、空=全部（兼容旧数据）
            const requested: ('MAIL' | 'SELF_PICKUP')[] = deliveryMethod ? [deliveryMethod] : [];
            const eligibleLocs = requested.length ? filterLocationsByDelivery(locs, requested) : locs;

            // 按城市聚合：city 为空 → 全部 eligible 仓；否则仅服务该城市的 eligible 仓
            const cities = new Map<string, unknown>();
            for (const loc of eligibleLocs) {
                cities.set(String(loc.id), (loc.customFields as any)?.serviceCities);
            }
            const { servedLocations, servedOnHand } = pinByCity(
                levels.map(l => ({ stockLocationId: l.stockLocationId, stockOnHand: l.stockOnHand })),
                bindings,
                cities,
                city,
            );

            const servedLocs = servedLocations.length ? eligibleLocs.filter(l =>
                servedLocations.some(id => String(id) === String(l.id))) : [];
            stockDetail = servedLocs
                .map(loc => {
                    const level = levels.find(l => String(l.stockLocationId) === String(loc.id));
                    const c = (loc.customFields as any) ?? {};
                    const distanceKm = origin
                        ? haversineKm(origin.lat, origin.lng, c.lat ?? 0, c.lng ?? 0)
                        : null;
                    return {
                        locationId: loc.id,
                        name: loc.name,
                        lat: c.lat ?? null,
                        lng: c.lng ?? null,
                        onHand: level?.stockOnHand ?? 0,
                        distanceKm,
                    };
                })
                .sort((a, b) => {
                    if (a.distanceKm == null) return 1;
                    if (b.distanceKm == null) return -1;
                    return a.distanceKm - b.distanceKm;
                });
            // 提供 city 时主库存取城市仓合计；城市无仓可服务或未提供 city 回退全局虚拟仓
            if (city) {
                saleableStock = servedOnHand > 0 ? servedOnHand : virtualOnHand;
            }
        }
        return { variantId, saleableStock, physicalStockEnabled, stockDetail };
    }
}

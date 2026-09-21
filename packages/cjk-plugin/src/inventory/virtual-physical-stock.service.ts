import { Injectable } from '@nestjs/common';
import {
    Channel,
    EventBus,
    ID,
    Logger,
    Order,
    RequestContext,
    StockLevel,
    StockLevelService,
    StockLocation,
    StockLocationService,
    StockMovementEvent,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';
import { Sale } from '@vendure/core';
import { InventoryService, LedgerMeta } from '@vendure/inventory-plugin';
import { In } from 'typeorm';
import { VariantLocationBinding } from './variant-location-binding.entity';
import { StockReservationItemEntity } from './stock-reservation-item.entity';
import { calcMirrorDelta, haversineKm, sumBoundOnHand } from './mirror-math';
import { pinByCity } from './stock-city-filter';
import { filterLocationsByDelivery } from './delivery-methods';
import { DeliveryRecordService } from '../delivery/delivery-record.service';

const loggerCtx = 'VirtualPhysicalStockService';

/** 租户内单个仓摘要（web-admin 库存网点页唯一数据源） */
export interface TenantLocationSummary {
    id: string;
    name: string;
    code: string;
    kind: string;
    isSystem: boolean;
    deliveryMethods: string[] | null;
    serviceCities: string[] | null;
    lat: number | null;
    lng: number | null;
}

/** 租户库存方案概览：开关口径 + 系统仓落点 + 仓清单 */
export interface TenantInventoryOverview {
    channelCode: string;
    physicalStockEnabled: boolean;
    virtualCode: string;
    virtualLocationId: string | null;
    defaultPhysicalCode: string;
    defaultPhysicalLocationId: string | null;
    locations: TenantLocationSummary[];
}

export interface TenantLocationInput {
    name?: string;
    deliveryMethods?: string[] | null;
    serviceCities?: string[] | null;
    lat?: number | null;
    lng?: number | null;
}

const DELIVERY_METHODS = ['MAIL', 'SELF_PICKUP'];

/** 配送方式归一：只收白名单取值、去重；空数组 → null（null 语义 = 邮寄与自提都支持） */
export function normalizeDeliveryMethods(input?: string[] | null): string[] | null {
    const out = [
        ...new Set(
            (input ?? [])
                .map(v => String(v ?? '').trim().toUpperCase())
                .filter(v => DELIVERY_METHODS.includes(v)),
        ),
    ];
    return out.length ? out : null;
}

/** 服务城市归一：去空去重；空 → null（null 语义 = 全国可达） */
export function normalizeCities(input?: string[] | null): string[] | null {
    const out = [...new Set((input ?? []).map(v => String(v ?? '').trim()).filter(Boolean))];
    return out.length ? out : null;
}

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

    /** 系统仓：默认物理仓（code=租户编码）与虚拟仓（code=租户编码-virtual）——不可改码、不可删除 */
    isSystemLocationCode(channelCode: string, code: string): boolean {
        return !!code && (code === channelCode || code === this.virtualCode(channelCode));
    }

    private async findLocationByCode(ctx: RequestContext, code: string): Promise<StockLocation | null> {
        return this.connection
            .getRepository(ctx, StockLocation)
            .createQueryBuilder('loc')
            .where('loc.customFields.code = :code', { code })
            .getOne();
    }

    /**
     * 仓归属校验：channelCode 命中、或 code 等于租户编码 / `{租户编码}-*` 前缀。
     * 两者皆空的历史数据视为「当前渠道内未打标」，按可见即归属处理（否则旧网点会凭空消失）。
     */
    private codeBelongsToTenant(channelCode: string, cf: any): boolean {
        const code = String(cf?.code ?? '');
        const owner = String(cf?.channelCode ?? '');
        if (owner && owner !== channelCode) {
            return false;
        }
        if (!code) {
            return true;
        }
        return code === channelCode || code === this.virtualCode(channelCode) || code.startsWith(`${channelCode}-`);
    }

    /** 当前渠道可见的仓（channel-aware，天然排除其它租户渠道的仓） */
    private async channelLocations(ctx: RequestContext): Promise<StockLocation[]> {
        const { items } = await this.stockLocationService.findAll(ctx, { take: 500 } as any);
        return items;
    }

    /** 系统仓自愈：kind/code/channelCode 与规格不符时按规格回写（幂等，不触碰其它字段） */
    private async patchSystemLocation(
        ctx: RequestContext,
        loc: StockLocation,
        kind: 'virtual' | 'physical',
        code: string,
        channelCode: string,
    ): Promise<StockLocation> {
        const cf: any = (loc.customFields as any) ?? {};
        if (cf.kind === kind && cf.code === code && cf.channelCode === channelCode) {
            return loc;
        }
        loc.customFields = { ...cf, kind, code, channelCode } as any;
        return this.connection.getRepository(ctx, StockLocation).save(loc);
    }

    async ensureVirtualLocation(ctx: RequestContext, channel: Channel = ctx.channel): Promise<StockLocation> {
        const code = this.virtualCode(channel.code);
        const existing = await this.findLocationByCode(ctx, code);
        if (existing) {
            return this.patchSystemLocation(ctx, existing, 'virtual', code, channel.code);
        }
        const loc = await this.stockLocationService.create(ctx, {
            name: `${channel.code} 虚拟仓`,
            description: '网络销售可售源（系统自动创建）',
            customFields: { kind: 'virtual', code, channelCode: channel.code },
        } as any);
        Logger.info(`虚拟仓已创建: ${code}`, loggerCtx);
        return loc;
    }

    async ensureDefaultPhysicalLocation(ctx: RequestContext, channel: Channel = ctx.channel): Promise<StockLocation> {
        const code = channel.code;
        const existing = await this.findLocationByCode(ctx, code);
        if (existing) {
            return this.patchSystemLocation(ctx, existing, 'physical', code, channel.code);
        }
        const loc = await this.stockLocationService.create(ctx, {
            name: `${channel.code} 默认仓`,
            description: '物理库存默认仓（开启物理库存时自动创建）',
            customFields: { kind: 'physical', code, channelCode: channel.code },
        } as any);
        Logger.info(`默认物理仓已创建: ${code}`, loggerCtx);
        return loc;
    }

    /** 租户库存方案概览：开关口径 + 系统仓落点 + 本租户仓清单（web-admin「库存网点」唯一数据源） */
    async getTenantInventoryOverview(
        ctx: RequestContext,
        channel: Channel = ctx.channel,
    ): Promise<TenantInventoryOverview> {
        const prefix = channel.code;
        const virtualCode = this.virtualCode(prefix);
        const locations: TenantLocationSummary[] = (await this.channelLocations(ctx))
            .filter(l => this.codeBelongsToTenant(prefix, (l.customFields as any) ?? {}))
            .map(l => {
                const cf: any = (l.customFields as any) ?? {};
                const code = String(cf.code ?? '');
                return {
                    id: String(l.id),
                    name: l.name ?? '',
                    code,
                    kind: String(cf.kind ?? 'virtual'),
                    isSystem: this.isSystemLocationCode(prefix, code),
                    deliveryMethods: (cf.deliveryMethods ?? null) as string[] | null,
                    serviceCities: (cf.serviceCities ?? null) as string[] | null,
                    lat: cf.lat ?? null,
                    lng: cf.lng ?? null,
                };
            })
            // 默认物理仓置顶，其余按编码排序（空编码=历史数据排最后）
            .sort((a, b) => {
                const rank = (c: string) => (c === prefix ? 0 : c === virtualCode ? 1 : c ? 2 : 3);
                const dr = rank(a.code) - rank(b.code);
                return dr !== 0 ? dr : a.code.localeCompare(b.code);
            });
        return {
            channelCode: prefix,
            physicalStockEnabled: Boolean((channel.customFields as any)?.physicalStockEnabled),
            virtualCode,
            virtualLocationId: locations.find(l => l.code === virtualCode)?.id ?? null,
            defaultPhysicalCode: prefix,
            defaultPhysicalLocationId: locations.find(l => l.code === prefix)?.id ?? null,
            locations,
        };
    }

    /** 幂等补建系统仓：虚拟仓恒在；开关开启时补默认物理仓。返回概览供前端直接刷新 */
    async ensureTenantInventoryLocations(
        ctx: RequestContext,
        channel: Channel = ctx.channel,
    ): Promise<TenantInventoryOverview> {
        await this.ensureVirtualLocation(ctx, channel);
        if (Boolean((channel.customFields as any)?.physicalStockEnabled)) {
            await this.ensureDefaultPhysicalLocation(ctx, channel);
        }
        return this.getTenantInventoryOverview(ctx, channel);
    }

    /** 租户内下一个附加物理仓编码：`{租户编码}-{两位序号}`，占用则顺延 */
    private async nextTenantLocationCode(ctx: RequestContext, channelCode: string): Promise<string> {
        const used = new Set<string>();
        for (const l of await this.channelLocations(ctx)) {
            const code = String(((l.customFields as any) ?? {}).code ?? '');
            if (code.startsWith(`${channelCode}-`)) {
                used.add(code.slice(channelCode.length + 1));
            }
        }
        for (let i = 1; i <= 999; i++) {
            const seq = String(i).padStart(2, '0');
            if (!used.has(seq)) {
                return `${channelCode}-${seq}`;
            }
        }
        throw new UserInputError(`租户 ${channelCode} 的仓库编码已达上限（999 个）`);
    }

    /** 取当前渠道可见且归属本租户的仓（越权/跨租户一律拒绝） */
    private async findTenantLocation(ctx: RequestContext, channelCode: string, id: ID): Promise<StockLocation> {
        const loc = (await this.channelLocations(ctx)).find(l => String(l.id) === String(id));
        if (!loc) {
            throw new UserInputError('仓库不存在或不属于当前渠道');
        }
        if (!this.codeBelongsToTenant(channelCode, (loc.customFields as any) ?? {})) {
            throw new UserInputError('仓库不属于当前租户');
        }
        return loc;
    }

    /**
     * 新建租户物理仓。编码与性质由服务端生成（`{租户编码}-{两位序号}` / physical），
     * 归属强制落当前租户——前端不可指定，避免出现「无编码/非物理仓」而无法绑定变体的仓。
     */
    async createTenantPhysicalLocation(
        ctx: RequestContext,
        input: TenantLocationInput,
        channel: Channel = ctx.channel,
    ): Promise<TenantInventoryOverview> {
        const name = String(input?.name ?? '').trim();
        if (!name) {
            throw new UserInputError('仓库名称不能为空');
        }
        const code = await this.nextTenantLocationCode(ctx, channel.code);
        await this.stockLocationService.create(ctx, {
            name,
            description: '租户物理仓（自动编码）',
            customFields: {
                kind: 'physical',
                code,
                channelCode: channel.code,
                deliveryMethods: normalizeDeliveryMethods(input?.deliveryMethods),
                serviceCities: normalizeCities(input?.serviceCities),
                lat: input?.lat ?? null,
                lng: input?.lng ?? null,
            },
        } as any);
        Logger.info(`租户物理仓已创建: ${code}`, loggerCtx);
        return this.getTenantInventoryOverview(ctx, channel);
    }

    /**
     * 更新租户仓（名称/配送方式/服务城市/坐标）。
     * 编码与性质不可改：系统虚拟仓整体禁改；默认物理仓强制 kind=physical；
     * 历史未打标数据仅补归属 channelCode，不改 kind/code（避免库存口径漂移）。
     */
    async updateTenantPhysicalLocation(
        ctx: RequestContext,
        input: TenantLocationInput & { id: ID },
        channel: Channel = ctx.channel,
    ): Promise<TenantInventoryOverview> {
        const loc = await this.findTenantLocation(ctx, channel.code, input?.id);
        const cf: any = (loc.customFields as any) ?? {};
        const code = String(cf.code ?? '');
        if (code === this.virtualCode(channel.code)) {
            throw new UserInputError('虚拟仓为系统仓，不可编辑');
        }
        const patch: any = { id: loc.id };
        if (input.name !== undefined) {
            const name = String(input.name ?? '').trim();
            if (!name) {
                throw new UserInputError('仓库名称不能为空');
            }
            patch.name = name;
        }
        const cfPatch: any = {};
        if (!String(cf.channelCode ?? '')) {
            cfPatch.channelCode = channel.code;
        }
        if (code === channel.code) {
            cfPatch.kind = 'physical';
        }
        if (input.deliveryMethods !== undefined) {
            cfPatch.deliveryMethods = normalizeDeliveryMethods(input.deliveryMethods);
        }
        if (input.serviceCities !== undefined) {
            cfPatch.serviceCities = normalizeCities(input.serviceCities);
        }
        if (input.lat !== undefined) {
            cfPatch.lat = input.lat ?? null;
        }
        if (input.lng !== undefined) {
            cfPatch.lng = input.lng ?? null;
        }
        if (Object.keys(cfPatch).length) {
            patch.customFields = cfPatch;
        }
        await this.stockLocationService.update(ctx, patch);
        return this.getTenantInventoryOverview(ctx, channel);
    }

    /** 删除租户仓；系统仓（默认物理仓 / 虚拟仓）不可删除 */
    async deleteTenantPhysicalLocation(
        ctx: RequestContext,
        id: ID,
        channel: Channel = ctx.channel,
    ): Promise<TenantInventoryOverview> {
        const loc = await this.findTenantLocation(ctx, channel.code, id);
        const code = String(((loc.customFields as any) ?? {}).code ?? '');
        if (this.isSystemLocationCode(channel.code, code)) {
            throw new UserInputError('系统仓（默认物理仓 / 虚拟仓）不可删除');
        }
        await this.assertLocationDeletable(ctx, loc);
        await this.stockLocationService.delete(ctx, { id: loc.id });
        return this.getTenantInventoryOverview(ctx, channel);
    }

    /**
     * 删仓前置安全校验：core 的 delete 未传 transferToLocationId 时会级联删除该仓全部 StockLevel
     * （库存静默蒸发），因此仍有库存 / 被变体绑定 / 有未完成出库预留时一律拒绝。
     */
    private async assertLocationDeletable(ctx: RequestContext, loc: StockLocation): Promise<void> {
        const levels = await this.connection
            .getRepository(ctx, StockLevel)
            .find({ where: { stockLocationId: loc.id } });
        const held = levels.reduce((sum, l) => sum + (l.stockOnHand ?? 0) + (l.stockAllocated ?? 0), 0);
        if (held > 0) {
            throw new UserInputError(`仓库「${loc.name}」仍有库存 ${held}，请先调拨或清零后再删除`);
        }
        const binding = await this.connection
            .getRepository(ctx, VariantLocationBinding)
            .findOne({ where: { locationId: loc.id } });
        if (binding) {
            throw new UserInputError(`仓库「${loc.name}」仍被商品变体绑定，请先解绑后再删除`);
        }
        const reservation = await this.connection
            .getRepository(ctx, StockReservationItemEntity)
            .findOne({ where: { stockLocationId: loc.id as number, status: 'PENDING' } });
        if (reservation) {
            throw new UserInputError(`仓库「${loc.name}」仍有未完成的出库预留，暂不可删除`);
        }
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

    /**
     * 统一物理仓调库原语（单据/预留单/订单钩子共用）：
     * delta>0 入库、delta<0 出库。负 delta 校验物理仓 onHand 充足，不足抛「物理库存不足」。
     * 复用 inventory-plugin 的 adjustStockPublic：写 StockAdjustment 流水 + 可选 OrderStockLedger 账本。
     */
    async adjustPhysicalStock(
        ctx: RequestContext,
        variantId: ID,
        locationId: ID,
        delta: number,
        reason: string,
        meta?: LedgerMeta,
    ): Promise<void> {
        if (delta === 0) {
            return;
        }
        if (delta < 0) {
            const current = await this.stockLevelService.getStockLevel(ctx, variantId, locationId);
            if (current.stockOnHand + delta < 0) {
                throw new UserInputError(
                    `物理库存不足：variant=${variantId} 仓库=${locationId} 需${-delta} 现有${current.stockOnHand}`,
                );
            }
        }
        await this.inventoryService.adjustStockPublic(ctx, variantId, locationId, delta, reason, meta);
    }

    /**
     * 物理仓盘点覆盖语义：将某仓 onHand 置为绝对值 targetOnHand。
     * 返回实际差异 delta（目标-当前），写 stocktake 账本流水（meta.bizCode=单据号）。
     */
    async setPhysicalStock(
        ctx: RequestContext,
        variantId: ID,
        locationId: ID,
        targetOnHand: number,
        reason: string,
        meta?: LedgerMeta,
    ): Promise<number> {
        const current = await this.stockLevelService.getStockLevel(ctx, variantId, locationId);
        const delta = targetOnHand - current.stockOnHand;
        if (delta !== 0) {
            await this.inventoryService.adjustStockPublic(ctx, variantId, locationId, delta, reason, meta);
        }
        return delta;
    }
}

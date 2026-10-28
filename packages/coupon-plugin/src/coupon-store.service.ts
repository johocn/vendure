import { Injectable, Optional } from '@nestjs/common';
import { ID, RequestContext, TransactionalConnection, UserInputError } from '@vendure/core';
import { MerchantStorePublic, MerchantStoreService } from '@vendure/merchant-plugin';

import { CouponService } from './coupon.service';
import { CouponStoreBinding } from './coupon-store-binding.entity';
import { CouponRedemption } from './coupon-redemption.entity';
import { CouponTemplate } from './coupon-template.entity';
import { CustomerCoupon } from './customer-coupon.entity';

/** 门店可选项（shop-api CouponStoreOption 的载体） */
export interface CouponStoreOption {
    id: number;
    name: string;
    address: string;
    phoneNumber: string | null;
    businessHoursText: string | null;
    isOpenNow: boolean;
    distanceKm: number | null;
    lat: number | null;
    lng: number | null;
    photos: string[];
}

/** 到店核销结果 */
export interface CouponRedemptionResult {
    couponId: number;
    couponCode: string;
    status: string;
    storeId: number;
    storeName: string;
    redeemedAt: Date;
}

/**
 * 券 ↔ 门店联动服务。
 *
 * 回归红线：模板无任何 coupon_store_binding 记录（默认 storeCoverage='ALL'）时，
 * assertStoreCoverage 直接放行、门店列表回退为「附近全部门店」，历史券行为完全不变。
 * merchant-plugin 未装载（独立部署 / 纯券 e2e）时，门店相关能力降级为空列表，
 * 仅显式传入门店的操作才报错，不影响既有链路。
 */
@Injectable()
export class CouponStoreService {
    constructor(
        private connection: TransactionalConnection,
        private couponService: CouponService,
        // 跨插件注入：merchant-plugin 与本插件同属一个 Nest 应用；未装载时降级为空能力
        @Optional() private merchantStoreService?: MerchantStoreService,
    ) {}

    /** 启动时由 CouponPlugin 经 Injector 注入：coupon 模块未 import merchant 模块，构造注入拿不到实例 */
    setStoreService(svc: MerchantStoreService): void {
        this.merchantStoreService = svc;
    }

    /** 当前渠道下模板的门店绑定 */
    private findBindings(ctx: RequestContext, templateId: ID): Promise<CouponStoreBinding[]> {
        return this.connection.getRepository(ctx, CouponStoreBinding).find({
            where: { templateId: Number(templateId), channelId: Number(ctx.channelId) },
            order: { priority: 'DESC', id: 'ASC' },
        });
    }

    /** 模板可用门店列表：无绑定 → 附近全部门店；有绑定 → 绑定门店（坐标场景保持距离排序） */
    async templateStores(
        ctx: RequestContext,
        templateId: ID,
        lat?: number | null,
        lng?: number | null,
    ): Promise<CouponStoreOption[]> {
        const svc = this.merchantStoreService;
        if (!svc) return [];
        const bindings = await this.findBindings(ctx, templateId);
        const includeIds = uniq(bindings.filter(b => b.type === 'INCLUDE').map(b => Number(b.storeId)));
        const excludeIds = new Set(bindings.filter(b => b.type === 'EXCLUDE').map(b => Number(b.storeId)));

        let stores: MerchantStorePublic[];
        if (includeIds.length > 0) {
            if (lat != null && lng != null) {
                // 坐标场景：在附近结果里按绑定 id 过滤，保留 merchant-plugin 的距离排序
                const allowed = new Set(includeIds);
                const nearby = await svc.findNearby(ctx, { lat, lng });
                stores = nearby.filter((s: any) => allowed.has(Number(s.id)));
            } else {
                // merchant-plugin 的 findPublicByIds 可能返回实体或公开投影，统一归一化为公开投影
                const raw = (await svc.findPublicByIds(ctx, includeIds)) as any[];
                stores = raw.map((s: any) => this.asPublic(svc, s));
            }
        } else {
            stores = await svc.findNearby(ctx, { lat: lat ?? undefined, lng: lng ?? undefined });
        }
        return stores
            .filter(s => !excludeIds.has(Number(s.id)))
            .map(s => toStoreOption(s));
    }

    /** 按券码取本人券 → 模板 → 可用门店列表（与 getMyCouponByCode 同口径） */
    async storesForCoupon(
        ctx: RequestContext,
        code: string,
        lat?: number | null,
        lng?: number | null,
    ): Promise<CouponStoreOption[]> {
        const coupon = await this.couponService.getMyCouponByCode(ctx, code);
        if (!coupon) {
            throw new UserInputError('Coupon not found');
        }
        return this.templateStores(ctx, coupon.templateId, lat, lng);
    }

    /**
     * 门店覆盖校验：无绑定行直接放行（历史券不变）；
     * 有绑定行时 storeId 必须在 INCLUDE 集合内（若存在 INCLUDE）且不在 EXCLUDE 集合。
     */
    async assertStoreCoverage(ctx: RequestContext, templateId: ID, storeId: ID): Promise<void> {
        const bindings = await this.findBindings(ctx, templateId);
        if (bindings.length === 0) return;
        const sid = Number(storeId);
        const include = new Set(bindings.filter(b => b.type === 'INCLUDE').map(b => Number(b.storeId)));
        const exclude = new Set(bindings.filter(b => b.type === 'EXCLUDE').map(b => Number(b.storeId)));
        if (exclude.has(sid)) {
            throw new UserInputError('This store does not accept the coupon');
        }
        if (include.size > 0 && !include.has(sid)) {
            throw new UserInputError('Coupon is not usable at this store');
        }
    }

    /** 购券时解析门店快照（不要求门店当下营业，不阻断购券） */
    async resolveStoreSnapshot(
        ctx: RequestContext,
        storeId: ID,
    ): Promise<{ storeId: number; snapshot: Record<string, any> }> {
        const svc = this.requireStoreService();
        const store = await svc.getOrThrow(ctx, storeId);
        const pub = svc.toPublic(store);
        return { storeId: Number(storeId), snapshot: snapshotOf(pub) };
    }

    /** 到店核销：校验持有/状态/有效期/覆盖范围/门店可核销后置 USED 并写核销流水 */
    async redeemAtStore(ctx: RequestContext, code: string, storeId: ID): Promise<CouponRedemptionResult> {
        const svc = this.requireStoreService();
        if (!ctx.activeUserId) {
            throw new UserInputError('Please sign in to redeem the coupon');
        }
        // 本人持有 + 惰性过期收敛（getMyCouponByCode 内已做 expireDueCoupons，非本人券返回 null）
        const coupon = await this.couponService.getMyCouponByCode(ctx, code);
        if (!coupon) {
            throw new UserInputError('Coupon not found');
        }
        if (coupon.status !== 'UNUSED' && coupon.status !== 'RETURNED') {
            throw new UserInputError(`Coupon is ${coupon.status}`);
        }
        // 模板停用后不再允许核销（与到店收银列表 listInStoreCoupons 的口径一致）
        if (coupon.template && !coupon.template.enabled) {
            throw new UserInputError('Coupon template is disabled');
        }
        // 已被代买单预占的券状态仍是 UNUSED，扫码核销会与线上委托单双花，预占期间一律拒绝
        // （与 in-store-bill 的 locate 校验口径一致）
        if (coupon.reservedOrderId) {
            throw new UserInputError('Coupon is reserved by another order');
        }
        if (coupon.expiredAt && new Date(coupon.expiredAt).getTime() <= Date.now()) {
            throw new UserInputError('Coupon has expired');
        }
        await this.assertStoreCoverage(ctx, coupon.templateId, storeId);
        const store = await svc.assertRedeemable(ctx, storeId);
        const pub = svc.toPublic(store);
        const now = new Date();

        // 原子置 USED：并发扫码（含退款回退的 RETURNED 券）只有一笔成功
        const couponRepo = this.connection.getRepository(ctx, CustomerCoupon);
        const claim = await couponRepo
            .createQueryBuilder()
            .update(CustomerCoupon)
            .set({ status: 'USED', usedAt: now, redeemedStoreId: Number(storeId), usedOrderId: null as any } as any)
            .where("id = :id AND status IN ('UNUSED', 'RETURNED')", { id: Number(coupon.id) })
            .execute();
        if ((claim.affected ?? 0) === 0) {
            throw new UserInputError('Coupon is not redeemable now');
        }

        await this.connection.getRepository(ctx, CouponRedemption).save(
            new CouponRedemption({
                customerCouponId: Number(coupon.id),
                couponCode: coupon.code,
                templateId: coupon.templateId,
                saleOrderId: coupon.saleOrderId ?? null,
                merchantId: pub.merchantId ?? null,
                storeId: Number(storeId),
                channelId: Number(ctx.channelId),
                redeemMode: 'QR',
                operatorId: null,
                operatorName: null,
                redeemedAt: now,
                revokedAt: null,
                revokeReason: null,
                amount: null,
                storeSnapshot: snapshotOf(pub),
                deviceInfo: null,
            }),
        );

        return {
            couponId: Number(coupon.id),
            couponCode: coupon.code,
            status: 'USED',
            storeId: Number(storeId),
            storeName: pub.name,
            redeemedAt: now,
        };
    }

    // ===== admin =====

    async listBindings(ctx: RequestContext, templateId: ID): Promise<CouponStoreBinding[]> {
        return this.findBindings(ctx, templateId);
    }

    /**
     * 全量替换模板门店绑定：空数组 → storeCoverage='ALL'（不限门店），
     * 否则 storeCoverage = coverage || 'STORE'。
     */
    async setBindings(
        ctx: RequestContext,
        templateId: ID,
        storeIds: ID[],
        coverage?: string | null,
    ): Promise<CouponStoreBinding[]> {
        const templateRepo = this.connection.getRepository(ctx, CouponTemplate);
        const tpl = await templateRepo.findOne({ where: { id: templateId as any } });
        if (!tpl) {
            throw new UserInputError(`CouponTemplate ${templateId} not found`);
        }
        const ids = uniq((storeIds ?? []).map(id => Number(id)).filter(id => Number.isFinite(id)));
        const merchantIdByStore = new Map<number, number | null>();
        if (ids.length > 0) {
            const svc = this.requireStoreService();
            const stores = await svc.findByIds(ctx, ids);
            if (stores.length !== ids.length) {
                throw new UserInputError('Some stores do not exist');
            }
            for (const store of stores) {
                merchantIdByStore.set(Number(store.id), store.merchantId != null ? Number(store.merchantId) : null);
            }
        }

        const repo = this.connection.getRepository(ctx, CouponStoreBinding);
        // 全量替换：先清后插（同一事务内由 @Transaction 保证原子性）
        await repo.delete({ templateId: Number(templateId), channelId: Number(ctx.channelId) });
        const saved: CouponStoreBinding[] = [];
        for (const storeId of ids) {
            saved.push(
                await repo.save(
                    new CouponStoreBinding({
                        templateId: Number(templateId),
                        bundleId: null,
                        merchantId: merchantIdByStore.get(storeId) ?? null,
                        storeId,
                        type: 'INCLUDE',
                        priority: 0,
                        isDefault: false,
                        channelId: Number(ctx.channelId),
                    }),
                ),
            );
        }

        tpl.storeCoverage = ids.length === 0 ? 'ALL' : coverage || 'STORE';
        await templateRepo.save(tpl);
        return saved;
    }

    async listRedemptions(
        ctx: RequestContext,
        templateId?: ID | null,
        storeId?: ID | null,
        limit?: number | null,
    ): Promise<CouponRedemption[]> {
        const qb = this.connection
            .getRepository(ctx, CouponRedemption)
            .createQueryBuilder('r')
            .where('r.channelId = :channelId', { channelId: Number(ctx.channelId) });
        if (templateId != null) {
            qb.andWhere('r.templateId = :templateId', { templateId: Number(templateId) });
        }
        if (storeId != null) {
            qb.andWhere('r.storeId = :storeId', { storeId: Number(storeId) });
        }
        qb.orderBy('r.id', 'DESC').take(Math.min(Math.max(Number(limit ?? 50), 1), 200));
        return qb.getMany();
    }

    private requireStoreService(): MerchantStoreService {
        if (!this.merchantStoreService) {
            throw new UserInputError('Merchant store service is not available');
        }
        return this.merchantStoreService;
    }

    /** 统一门店形态：已是公开投影（含 coordinates 字段）则直接使用，否则用 toPublic 转换 */
    private asPublic(svc: MerchantStoreService, store: any): MerchantStorePublic {
        if (store && store.coordinates !== undefined && typeof store.isOpenNow === 'boolean') {
            return store as MerchantStorePublic;
        }
        return svc.toPublic(store);
    }
}

function uniq(nums: number[]): number[] {
    return Array.from(new Set(nums));
}

/** 门店快照（落库到 coupon_sale_order.storeSnapshot / coupon_redemption.storeSnapshot） */
function snapshotOf(store: MerchantStorePublic): Record<string, any> {
    return {
        name: store.name,
        address: store.address,
        phoneNumber: store.phoneNumber ?? null,
        businessHoursText: store.businessHoursText ?? null,
        lat: store.coordinates?.lat ?? null,
        lng: store.coordinates?.lng ?? null,
    };
}

function toStoreOption(store: MerchantStorePublic): CouponStoreOption {
    return {
        id: Number(store.id),
        name: store.name,
        address: store.address,
        phoneNumber: store.phoneNumber ?? null,
        businessHoursText: store.businessHoursText ?? null,
        isOpenNow: !!store.isOpenNow,
        distanceKm: store.distanceKm ?? null,
        lat: store.coordinates?.lat ?? null,
        lng: store.coordinates?.lng ?? null,
        photos: store.photos ?? [],
    };
}

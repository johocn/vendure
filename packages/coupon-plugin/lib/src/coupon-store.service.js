"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CouponStoreService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const merchant_plugin_1 = require("@vendure/merchant-plugin");
const coupon_service_1 = require("./coupon.service");
const coupon_store_binding_entity_1 = require("./coupon-store-binding.entity");
const coupon_redemption_entity_1 = require("./coupon-redemption.entity");
const coupon_template_entity_1 = require("./coupon-template.entity");
const customer_coupon_entity_1 = require("./customer-coupon.entity");
/**
 * 券 ↔ 门店联动服务。
 *
 * 回归红线：模板无任何 coupon_store_binding 记录（默认 storeCoverage='ALL'）时，
 * assertStoreCoverage 直接放行、门店列表回退为「附近全部门店」，历史券行为完全不变。
 * merchant-plugin 未装载（独立部署 / 纯券 e2e）时，门店相关能力降级为空列表，
 * 仅显式传入门店的操作才报错，不影响既有链路。
 */
let CouponStoreService = class CouponStoreService {
    constructor(connection, couponService, merchantStoreService) {
        this.connection = connection;
        this.couponService = couponService;
        this.merchantStoreService = merchantStoreService;
    }
    /** 当前渠道下模板的门店绑定 */
    findBindings(ctx, templateId) {
        return this.connection.getRepository(ctx, coupon_store_binding_entity_1.CouponStoreBinding).find({
            where: { templateId: Number(templateId), channelId: Number(ctx.channelId) },
            order: { priority: 'DESC', id: 'ASC' },
        });
    }
    /** 模板可用门店列表：无绑定 → 附近全部门店；有绑定 → 绑定门店（坐标场景保持距离排序） */
    async templateStores(ctx, templateId, lat, lng) {
        const svc = this.merchantStoreService;
        if (!svc)
            return [];
        const bindings = await this.findBindings(ctx, templateId);
        const includeIds = uniq(bindings.filter(b => b.type === 'INCLUDE').map(b => Number(b.storeId)));
        const excludeIds = new Set(bindings.filter(b => b.type === 'EXCLUDE').map(b => Number(b.storeId)));
        let stores;
        if (includeIds.length > 0) {
            if (lat != null && lng != null) {
                // 坐标场景：在附近结果里按绑定 id 过滤，保留 merchant-plugin 的距离排序
                const allowed = new Set(includeIds);
                const nearby = await svc.findNearby(ctx, { lat, lng });
                stores = nearby.filter((s) => allowed.has(Number(s.id)));
            }
            else {
                // merchant-plugin 的 findPublicByIds 可能返回实体或公开投影，统一归一化为公开投影
                const raw = (await svc.findPublicByIds(ctx, includeIds));
                stores = raw.map((s) => this.asPublic(svc, s));
            }
        }
        else {
            stores = await svc.findNearby(ctx, { lat: lat !== null && lat !== void 0 ? lat : undefined, lng: lng !== null && lng !== void 0 ? lng : undefined });
        }
        return stores
            .filter(s => !excludeIds.has(Number(s.id)))
            .map(s => toStoreOption(s));
    }
    /** 按券码取本人券 → 模板 → 可用门店列表（与 getMyCouponByCode 同口径） */
    async storesForCoupon(ctx, code, lat, lng) {
        const coupon = await this.couponService.getMyCouponByCode(ctx, code);
        if (!coupon) {
            throw new core_1.UserInputError('Coupon not found');
        }
        return this.templateStores(ctx, coupon.templateId, lat, lng);
    }
    /**
     * 门店覆盖校验：无绑定行直接放行（历史券不变）；
     * 有绑定行时 storeId 必须在 INCLUDE 集合内（若存在 INCLUDE）且不在 EXCLUDE 集合。
     */
    async assertStoreCoverage(ctx, templateId, storeId) {
        const bindings = await this.findBindings(ctx, templateId);
        if (bindings.length === 0)
            return;
        const sid = Number(storeId);
        const include = new Set(bindings.filter(b => b.type === 'INCLUDE').map(b => Number(b.storeId)));
        const exclude = new Set(bindings.filter(b => b.type === 'EXCLUDE').map(b => Number(b.storeId)));
        if (exclude.has(sid)) {
            throw new core_1.UserInputError('This store does not accept the coupon');
        }
        if (include.size > 0 && !include.has(sid)) {
            throw new core_1.UserInputError('Coupon is not usable at this store');
        }
    }
    /** 购券时解析门店快照（不要求门店当下营业，不阻断购券） */
    async resolveStoreSnapshot(ctx, storeId) {
        const svc = this.requireStoreService();
        const store = await svc.getOrThrow(ctx, storeId);
        const pub = svc.toPublic(store);
        return { storeId: Number(storeId), snapshot: snapshotOf(pub) };
    }
    /** 到店核销：校验持有/状态/有效期/覆盖范围/门店可核销后置 USED 并写核销流水 */
    async redeemAtStore(ctx, code, storeId) {
        var _a, _b, _c;
        const svc = this.requireStoreService();
        if (!ctx.activeUserId) {
            throw new core_1.UserInputError('Please sign in to redeem the coupon');
        }
        // 本人持有 + 惰性过期收敛（getMyCouponByCode 内已做 expireDueCoupons，非本人券返回 null）
        const coupon = await this.couponService.getMyCouponByCode(ctx, code);
        if (!coupon) {
            throw new core_1.UserInputError('Coupon not found');
        }
        if (coupon.status !== 'UNUSED') {
            throw new core_1.UserInputError(`Coupon is ${coupon.status}`);
        }
        if (coupon.expiredAt && new Date(coupon.expiredAt).getTime() <= Date.now()) {
            throw new core_1.UserInputError('Coupon has expired');
        }
        await this.assertStoreCoverage(ctx, coupon.templateId, storeId);
        const store = await svc.assertRedeemable(ctx, storeId);
        const pub = svc.toPublic(store);
        const now = new Date();
        // 原子置 USED：并发扫码只有一笔成功
        const couponRepo = this.connection.getRepository(ctx, customer_coupon_entity_1.CustomerCoupon);
        const claim = await couponRepo
            .createQueryBuilder()
            .update(customer_coupon_entity_1.CustomerCoupon)
            .set({ status: 'USED', usedAt: now, redeemedStoreId: Number(storeId) })
            .where('id = :id AND status = :status', { id: Number(coupon.id), status: 'UNUSED' })
            .execute();
        if (((_a = claim.affected) !== null && _a !== void 0 ? _a : 0) === 0) {
            throw new core_1.UserInputError('Coupon is not redeemable now');
        }
        await this.connection.getRepository(ctx, coupon_redemption_entity_1.CouponRedemption).save(new coupon_redemption_entity_1.CouponRedemption({
            customerCouponId: Number(coupon.id),
            couponCode: coupon.code,
            templateId: coupon.templateId,
            saleOrderId: (_b = coupon.saleOrderId) !== null && _b !== void 0 ? _b : null,
            merchantId: (_c = pub.merchantId) !== null && _c !== void 0 ? _c : null,
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
        }));
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
    async listBindings(ctx, templateId) {
        return this.findBindings(ctx, templateId);
    }
    /**
     * 全量替换模板门店绑定：空数组 → storeCoverage='ALL'（不限门店），
     * 否则 storeCoverage = coverage || 'STORE'。
     */
    async setBindings(ctx, templateId, storeIds, coverage) {
        var _a;
        const templateRepo = this.connection.getRepository(ctx, coupon_template_entity_1.CouponTemplate);
        const tpl = await templateRepo.findOne({ where: { id: templateId } });
        if (!tpl) {
            throw new core_1.UserInputError(`CouponTemplate ${templateId} not found`);
        }
        const ids = uniq((storeIds !== null && storeIds !== void 0 ? storeIds : []).map(id => Number(id)).filter(id => Number.isFinite(id)));
        const merchantIdByStore = new Map();
        if (ids.length > 0) {
            const svc = this.requireStoreService();
            const stores = await svc.findByIds(ctx, ids);
            if (stores.length !== ids.length) {
                throw new core_1.UserInputError('Some stores do not exist');
            }
            for (const store of stores) {
                merchantIdByStore.set(Number(store.id), store.merchantId != null ? Number(store.merchantId) : null);
            }
        }
        const repo = this.connection.getRepository(ctx, coupon_store_binding_entity_1.CouponStoreBinding);
        // 全量替换：先清后插（同一事务内由 @Transaction 保证原子性）
        await repo.delete({ templateId: Number(templateId), channelId: Number(ctx.channelId) });
        const saved = [];
        for (const storeId of ids) {
            saved.push(await repo.save(new coupon_store_binding_entity_1.CouponStoreBinding({
                templateId: Number(templateId),
                bundleId: null,
                merchantId: (_a = merchantIdByStore.get(storeId)) !== null && _a !== void 0 ? _a : null,
                storeId,
                type: 'INCLUDE',
                priority: 0,
                isDefault: false,
                channelId: Number(ctx.channelId),
            })));
        }
        tpl.storeCoverage = ids.length === 0 ? 'ALL' : coverage || 'STORE';
        await templateRepo.save(tpl);
        return saved;
    }
    async listRedemptions(ctx, templateId, storeId, limit) {
        const qb = this.connection
            .getRepository(ctx, coupon_redemption_entity_1.CouponRedemption)
            .createQueryBuilder('r')
            .where('r.channelId = :channelId', { channelId: Number(ctx.channelId) });
        if (templateId != null) {
            qb.andWhere('r.templateId = :templateId', { templateId: Number(templateId) });
        }
        if (storeId != null) {
            qb.andWhere('r.storeId = :storeId', { storeId: Number(storeId) });
        }
        qb.orderBy('r.id', 'DESC').take(Math.min(Math.max(Number(limit !== null && limit !== void 0 ? limit : 50), 1), 200));
        return qb.getMany();
    }
    requireStoreService() {
        if (!this.merchantStoreService) {
            throw new core_1.UserInputError('Merchant store service is not available');
        }
        return this.merchantStoreService;
    }
    /** 统一门店形态：已是公开投影（含 coordinates 字段）则直接使用，否则用 toPublic 转换 */
    asPublic(svc, store) {
        if (store && store.coordinates !== undefined && typeof store.isOpenNow === 'boolean') {
            return store;
        }
        return svc.toPublic(store);
    }
};
exports.CouponStoreService = CouponStoreService;
exports.CouponStoreService = CouponStoreService = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        coupon_service_1.CouponService,
        merchant_plugin_1.MerchantStoreService])
], CouponStoreService);
function uniq(nums) {
    return Array.from(new Set(nums));
}
/** 门店快照（落库到 coupon_sale_order.storeSnapshot / coupon_redemption.storeSnapshot） */
function snapshotOf(store) {
    var _a, _b, _c, _d, _e, _f;
    return {
        name: store.name,
        address: store.address,
        phoneNumber: (_a = store.phoneNumber) !== null && _a !== void 0 ? _a : null,
        businessHoursText: (_b = store.businessHoursText) !== null && _b !== void 0 ? _b : null,
        lat: (_d = (_c = store.coordinates) === null || _c === void 0 ? void 0 : _c.lat) !== null && _d !== void 0 ? _d : null,
        lng: (_f = (_e = store.coordinates) === null || _e === void 0 ? void 0 : _e.lng) !== null && _f !== void 0 ? _f : null,
    };
}
function toStoreOption(store) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    return {
        id: Number(store.id),
        name: store.name,
        address: store.address,
        phoneNumber: (_a = store.phoneNumber) !== null && _a !== void 0 ? _a : null,
        businessHoursText: (_b = store.businessHoursText) !== null && _b !== void 0 ? _b : null,
        isOpenNow: !!store.isOpenNow,
        distanceKm: (_c = store.distanceKm) !== null && _c !== void 0 ? _c : null,
        lat: (_e = (_d = store.coordinates) === null || _d === void 0 ? void 0 : _d.lat) !== null && _e !== void 0 ? _e : null,
        lng: (_g = (_f = store.coordinates) === null || _f === void 0 ? void 0 : _f.lng) !== null && _g !== void 0 ? _g : null,
        photos: (_h = store.photos) !== null && _h !== void 0 ? _h : [],
    };
}
//# sourceMappingURL=coupon-store.service.js.map
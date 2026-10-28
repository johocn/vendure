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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MerchantStoreService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
const business_hours_1 = require("./business-hours");
const localize_1 = require("./localize");
const merchant_entity_1 = require("./merchant.entity");
const merchant_store_entity_1 = require("./merchant-store.entity");
const merchant_store_channel_entity_1 = require("./merchant-store-channel.entity");
const merchant_store_staff_entity_1 = require("./merchant-store-staff.entity");
/** simple-json 字段：GraphQL 侧以 String 传入时在此处反序列化 */
const STORE_JSON_FIELDS = [
    'businessHours',
    'specialDates',
    'holidayPlan',
    'photos',
    'videos',
    'tags',
    'facilities',
    'externalIds',
];
function parseJsonValue(value) {
    if (typeof value !== 'string') {
        return value;
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }
    try {
        return JSON.parse(trimmed);
    }
    catch (_a) {
        // 非合法 JSON 原样保留，交由 simple-json 序列化
        return value;
    }
}
function coerceJsonFields(input, keys) {
    const copy = Object.assign({}, input);
    for (const key of keys) {
        if (copy[key] !== undefined) {
            copy[key] = parseJsonValue(copy[key]);
        }
    }
    return copy;
}
function round1(value) {
    return Math.round(value * 10) / 10;
}
/** 门店员工角色/状态枚举（与后台 UI 的选项保持一致，写入前校验） */
const STAFF_ROLES = ['OWNER', 'MANAGER', 'CLERK'];
const STAFF_STATUSES = ['ACTIVE', 'DISABLED'];
let MerchantStoreService = class MerchantStoreService {
    constructor(connection) {
        this.connection = connection;
    }
    // ------------------------------------------------------------------
    // 查询（C 端公开视图）
    // ------------------------------------------------------------------
    /**
     * 附近 / 可售门店列表：
     * 过滤 enabled、isPublic、未删除、status != CLOSED；有坐标按 Haversine 距离升序并回填
     * distanceKm（保留 1 位小数），无坐标按 sortOrder 升序、weight 降序。
     */
    async findNearby(ctx, opts = {}) {
        const qb = this.connection
            .getRepository(ctx, merchant_store_entity_1.MerchantStore)
            .createQueryBuilder('s')
            .leftJoinAndSelect('s.merchant', 'merchant')
            .where('s.enabled = :enabled', { enabled: true })
            .andWhere('s.isPublic = :isPublic', { isPublic: true })
            .andWhere('s.deletedAt IS NULL')
            .andWhere('s.status != :closed', { closed: 'CLOSED' });
        if (opts.city) {
            qb.andWhere('s.city = :city', { city: opts.city });
        }
        if (opts.merchantId != null) {
            qb.andWhere('s.merchantId = :merchantId', { merchantId: Number(opts.merchantId) });
        }
        const stores = await qb.getMany();
        const hasOrigin = typeof opts.lat === 'number' &&
            typeof opts.lng === 'number' &&
            Number.isFinite(opts.lat) &&
            Number.isFinite(opts.lng);
        let rows;
        if (hasOrigin) {
            rows = stores
                .map(store => {
                const distanceKm = store.lat != null && store.lng != null
                    ? round1(this.haversineDistance(opts.lat, opts.lng, store.lat, store.lng))
                    : null;
                return { store, distanceKm };
            })
                .sort((a, b) => {
                if (a.distanceKm == null && b.distanceKm == null) {
                    return this.compareBySortOrder(a.store, b.store);
                }
                if (a.distanceKm == null) {
                    return 1;
                }
                if (b.distanceKm == null) {
                    return -1;
                }
                return a.distanceKm - b.distanceKm;
            });
        }
        else {
            rows = stores
                .sort((a, b) => this.compareBySortOrder(a, b))
                .map(store => ({ store, distanceKm: null }));
        }
        if (typeof opts.limit === 'number' && opts.limit >= 0) {
            rows = rows.slice(0, opts.limit);
        }
        return rows.map(row => this.toPublic(row.store, {
            lat: opts.lat,
            lng: opts.lng,
            distanceKm: row.distanceKm,
        }));
    }
    /** 按 id 批量取公开可见门店（In 查询 + 公开过滤） */
    async findPublicByIds(ctx, ids) {
        const normalized = this.normalizeIds(ids);
        if (normalized.length === 0) {
            return [];
        }
        return this.connection
            .getRepository(ctx, merchant_store_entity_1.MerchantStore)
            .createQueryBuilder('s')
            .leftJoinAndSelect('s.merchant', 'merchant')
            .where('s.id IN (:...ids)', { ids: normalized })
            .andWhere('s.enabled = :enabled', { enabled: true })
            .andWhere('s.isPublic = :isPublic', { isPublic: true })
            .andWhere('s.deletedAt IS NULL')
            .andWhere('s.status != :closed', { closed: 'CLOSED' })
            .orderBy('s.sortOrder', 'ASC')
            .addOrderBy('s.weight', 'DESC')
            .getMany();
    }
    /** 按 id 批量取门店（后台全量语义，不做公开过滤） */
    async findByIds(ctx, ids) {
        const normalized = this.normalizeIds(ids);
        if (normalized.length === 0) {
            return [];
        }
        return this.connection.getRepository(ctx, merchant_store_entity_1.MerchantStore).find({
            where: { id: (0, typeorm_1.In)(normalized) },
            relations: { merchant: true },
        });
    }
    async getOrThrow(ctx, id) {
        // 已软删门店视同不存在：认领 / 员工 / 门店详情等写入入口不得再挂靠
        const store = await this.connection.getRepository(ctx, merchant_store_entity_1.MerchantStore).findOne({
            where: { id: id, deletedAt: (0, typeorm_1.IsNull)() },
            relations: { merchant: true },
        });
        if (!store) {
            throw new core_1.EntityNotFoundError('MerchantStore', id);
        }
        return store;
    }
    /** 门店当前是否营业：status=OPEN 且 acceptingOrders 且命中营业时间 */
    isOpenNow(store, at) {
        if (store.status !== 'OPEN' || !store.acceptingOrders) {
            return false;
        }
        return (0, business_hours_1.isOpenAt)({
            businessHours: store.businessHours,
            businessHoursText: store.businessHoursText,
            timezone: store.timezone,
        }, at);
    }
    /**
     * 券核销前置校验：门店必须可用、公开、未删除、OPEN、接单、支持核销且在营业时间内，
     * 任一不满足抛 UserInputError（中文原因）。
     */
    async assertRedeemable(ctx, storeId, at) {
        const store = await this.getOrThrow(ctx, storeId);
        if (!store.enabled) {
            throw new core_1.UserInputError('门店已停用');
        }
        if (!store.isPublic) {
            throw new core_1.UserInputError('门店未公开');
        }
        if (store.deletedAt != null) {
            throw new core_1.UserInputError('门店已删除');
        }
        if (store.status !== 'OPEN') {
            throw new core_1.UserInputError(`门店当前状态为 ${store.status}，不可核销`);
        }
        if (!store.acceptingOrders) {
            throw new core_1.UserInputError('门店暂停接单');
        }
        if (!store.supportsRedemption) {
            throw new core_1.UserInputError('门店不支持核销');
        }
        if (!this.isOpenNow(store, at)) {
            throw new core_1.UserInputError('当前不在门店营业时间内');
        }
        return store;
    }
    /** 门店实体 → C 端公开投影 */
    toPublic(store, opts = {}) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        const locale = (_a = opts.locale) !== null && _a !== void 0 ? _a : core_1.LanguageCode.zh_Hans;
        const coordinates = store.lat != null && store.lng != null
            ? { lat: Number(store.lat), lng: Number(store.lng) }
            : null;
        let distanceKm = (_b = opts.distanceKm) !== null && _b !== void 0 ? _b : null;
        if (distanceKm == null &&
            coordinates &&
            typeof opts.lat === 'number' &&
            typeof opts.lng === 'number') {
            distanceKm = round1(this.haversineDistance(opts.lat, opts.lng, coordinates.lat, coordinates.lng));
        }
        const hours = store.businessHours;
        return {
            id: Number(store.id),
            merchantId: Number(store.merchantId),
            merchantName: store.merchant ? (0, localize_1.localizeText)(store.merchant.name, locale, '') : '',
            name: (0, localize_1.localizeText)(store.name, locale, ''),
            storeType: store.storeType,
            status: store.status,
            address: this.formatAddress(store),
            province: (_c = store.province) !== null && _c !== void 0 ? _c : null,
            city: (_d = store.city) !== null && _d !== void 0 ? _d : null,
            district: (_e = store.district) !== null && _e !== void 0 ? _e : null,
            phoneNumber: (_f = store.phoneNumber) !== null && _f !== void 0 ? _f : null,
            backupPhone: (_g = store.backupPhone) !== null && _g !== void 0 ? _g : null,
            businessHoursText: (_h = store.businessHoursText) !== null && _h !== void 0 ? _h : null,
            businessHours: hours == null ? null : typeof hours === 'string' ? hours : JSON.stringify(hours),
            coordinates,
            photos: Array.isArray(store.photos) ? store.photos : [],
            coverImage: (_j = store.coverImage) !== null && _j !== void 0 ? _j : null,
            notice: store.notice == null ? null : (0, localize_1.localizeText)(store.notice, locale, '') || null,
            isOpenNow: this.isOpenNow(store, opts.now),
            distanceKm,
            mapPoiId: (_k = store.mapPoiId) !== null && _k !== void 0 ? _k : null,
        };
    }
    // ------------------------------------------------------------------
    // 商户 CRUD
    // ------------------------------------------------------------------
    async listMerchants(ctx, options = {}) {
        var _a, _b;
        const qb = this.connection.getRepository(ctx, merchant_entity_1.Merchant).createQueryBuilder('m');
        qb.andWhere('m.deletedAt IS NULL');
        if (options.keyword) {
            qb.andWhere('(m.code LIKE :kw OR m.name LIKE :kw OR m.legalName LIKE :kw OR m.contactName LIKE :kw)', { kw: `%${options.keyword}%` });
        }
        if (options.status) {
            qb.andWhere('m.status = :status', { status: options.status });
        }
        if (options.claimStatus) {
            qb.andWhere('m.claimStatus = :claimStatus', { claimStatus: options.claimStatus });
        }
        const [items, totalItems] = await qb
            .orderBy('m.createdAt', 'DESC')
            .skip((_a = options.skip) !== null && _a !== void 0 ? _a : 0)
            .take((_b = options.take) !== null && _b !== void 0 ? _b : 20)
            .getManyAndCount();
        return { items, totalItems };
    }
    async getMerchant(ctx, id) {
        const merchant = await this.connection.getRepository(ctx, merchant_entity_1.Merchant).findOne({
            where: { id: id, deletedAt: (0, typeorm_1.IsNull)() },
        });
        return merchant !== null && merchant !== void 0 ? merchant : undefined;
    }
    async createMerchant(ctx, input) {
        var _a;
        const repo = this.connection.getRepository(ctx, merchant_entity_1.Merchant);
        const code = String((_a = input === null || input === void 0 ? void 0 : input.code) !== null && _a !== void 0 ? _a : '').trim();
        if (!code) {
            throw new core_1.UserInputError('商户编码不能为空');
        }
        const exists = await repo.findOne({ where: { code } });
        if (exists) {
            throw new core_1.UserInputError('商户编码已存在');
        }
        const payload = coerceJsonFields(Object.assign(Object.assign({}, input), { code }), ['tags']);
        delete payload.claimStatus;
        if (payload.name == null || payload.name === '') {
            payload.name = code;
        }
        return repo.save(repo.create(payload));
    }
    async updateMerchant(ctx, input) {
        var _a;
        const repo = this.connection.getRepository(ctx, merchant_entity_1.Merchant);
        const merchant = await repo.findOne({ where: { id: input === null || input === void 0 ? void 0 : input.id } });
        if (!merchant) {
            throw new core_1.UserInputError('商户不存在');
        }
        const _b = input !== null && input !== void 0 ? input : {}, { id, claimStatus } = _b, rest = __rest(_b, ["id", "claimStatus"]);
        // claimStatus 由门店认领关系派生，不接受客户端直接改写
        if (rest.code !== undefined) {
            const code = String((_a = rest.code) !== null && _a !== void 0 ? _a : '').trim();
            if (!code) {
                throw new core_1.UserInputError('商户编码不能为空');
            }
            const dup = await repo.findOne({ where: { code } });
            if (dup && Number(dup.id) !== Number(merchant.id)) {
                throw new core_1.UserInputError('商户编码已存在');
            }
            rest.code = code;
        }
        Object.assign(merchant, coerceJsonFields(rest, ['tags']));
        return repo.save(merchant);
    }
    /**
     * 删除商户（软删）：仅置 deletedAt，保留关联数据用于历史追溯。
     * 商户下仍有未删除的门店时拒绝，避免出现悬挂引用。
     */
    async deleteMerchant(ctx, id) {
        const repo = this.connection.getRepository(ctx, merchant_entity_1.Merchant);
        const merchant = await repo.findOne({ where: { id: id, deletedAt: (0, typeorm_1.IsNull)() } });
        if (!merchant) {
            throw new core_1.UserInputError('商户不存在');
        }
        const activeStores = await this.connection.getRepository(ctx, merchant_store_entity_1.MerchantStore).count({
            where: { merchantId: Number(merchant.id), deletedAt: (0, typeorm_1.IsNull)() },
        });
        if (activeStores > 0) {
            throw new core_1.UserInputError('该商户下仍有门店，请先删除门店');
        }
        merchant.deletedAt = new Date();
        await repo.save(merchant);
        return true;
    }
    // ------------------------------------------------------------------
    // 门店 CRUD
    // ------------------------------------------------------------------
    async listStores(ctx, options = {}) {
        var _a, _b;
        const qb = this.connection
            .getRepository(ctx, merchant_store_entity_1.MerchantStore)
            .createQueryBuilder('s')
            .leftJoinAndSelect('s.merchant', 'merchant')
            .where('s.deletedAt IS NULL');
        if (options.merchantId != null) {
            qb.andWhere('s.merchantId = :merchantId', { merchantId: Number(options.merchantId) });
        }
        if (options.city) {
            qb.andWhere('s.city = :city', { city: options.city });
        }
        if (options.status) {
            qb.andWhere('s.status = :status', { status: options.status });
        }
        if (options.keyword) {
            qb.andWhere('(s.code LIKE :kw OR s.name LIKE :kw OR s.phoneNumber LIKE :kw)', {
                kw: `%${options.keyword}%`,
            });
        }
        const [items, totalItems] = await qb
            .orderBy('s.sortOrder', 'ASC')
            .addOrderBy('s.weight', 'DESC')
            .addOrderBy('s.createdAt', 'DESC')
            .skip((_a = options.skip) !== null && _a !== void 0 ? _a : 0)
            .take((_b = options.take) !== null && _b !== void 0 ? _b : 20)
            .getManyAndCount();
        return { items, totalItems };
    }
    async getStore(ctx, id) {
        const store = await this.connection.getRepository(ctx, merchant_store_entity_1.MerchantStore).findOne({
            where: { id: id, deletedAt: (0, typeorm_1.IsNull)() },
            relations: { merchant: true },
        });
        return store !== null && store !== void 0 ? store : undefined;
    }
    async createStore(ctx, input) {
        var _a;
        const repo = this.connection.getRepository(ctx, merchant_store_entity_1.MerchantStore);
        const code = String((_a = input === null || input === void 0 ? void 0 : input.code) !== null && _a !== void 0 ? _a : '').trim();
        if (!code) {
            throw new core_1.UserInputError('门店编码不能为空');
        }
        const merchantId = Number(input === null || input === void 0 ? void 0 : input.merchantId);
        if (!merchantId) {
            throw new core_1.UserInputError('门店必须归属商户');
        }
        const merchant = await this.connection.getRepository(ctx, merchant_entity_1.Merchant).findOne({
            where: { id: merchantId, deletedAt: (0, typeorm_1.IsNull)() },
        });
        if (!merchant) {
            throw new core_1.UserInputError('商户不存在');
        }
        const exists = await repo.findOne({ where: { code } });
        if (exists) {
            throw new core_1.UserInputError('门店编码已存在');
        }
        const payload = coerceJsonFields(Object.assign(Object.assign({}, input), { code, merchantId }), STORE_JSON_FIELDS);
        if (payload.name == null || payload.name === '') {
            payload.name = code;
        }
        return repo.save(repo.create(payload));
    }
    async updateStore(ctx, input) {
        var _a;
        const repo = this.connection.getRepository(ctx, merchant_store_entity_1.MerchantStore);
        const store = await repo.findOne({ where: { id: input === null || input === void 0 ? void 0 : input.id } });
        if (!store) {
            throw new core_1.UserInputError('门店不存在');
        }
        if (store.deletedAt != null) {
            throw new core_1.UserInputError('门店已删除');
        }
        // deletedAt 仅供删除接口写入，客户端不允许通过更新接口改写（防止「反向恢复」）
        const _b = input !== null && input !== void 0 ? input : {}, { id, deletedAt } = _b, rest = __rest(_b, ["id", "deletedAt"]);
        if (rest.merchantId != null) {
            const merchantId = Number(rest.merchantId);
            // 改挂商户必须指向存在且未删除的商户，避免门店挂到已删商户
            const merchant = await this.connection.getRepository(ctx, merchant_entity_1.Merchant).findOne({
                where: { id: merchantId, deletedAt: (0, typeorm_1.IsNull)() },
            });
            if (!merchant) {
                throw new core_1.UserInputError('商户不存在');
            }
            rest.merchantId = merchantId;
        }
        if (rest.code !== undefined) {
            const code = String((_a = rest.code) !== null && _a !== void 0 ? _a : '').trim();
            if (!code) {
                throw new core_1.UserInputError('门店编码不能为空');
            }
            const dup = await repo.findOne({ where: { code } });
            if (dup && Number(dup.id) !== Number(store.id)) {
                throw new core_1.UserInputError('门店编码已存在');
            }
            rest.code = code;
        }
        Object.assign(store, coerceJsonFields(rest, STORE_JSON_FIELDS));
        /** 保存后重新读取以带上 merchant 关系，方便返回 MerchantStore 类型字段 */
        return repo.save(store);
    }
    /**
     * 删除门店（软删）：置 deletedAt，保留历史订单/配送档案例引用。
     * 同步撤销该门店的 ACTIVE 租户认领，避免已删除门店仍被计入商户认领状态。
     */
    async deleteStore(ctx, id) {
        const repo = this.connection.getRepository(ctx, merchant_store_entity_1.MerchantStore);
        const store = await repo.findOne({ where: { id: id } });
        if (!store) {
            throw new core_1.UserInputError('门店不存在');
        }
        if (store.deletedAt != null) {
            throw new core_1.UserInputError('门店已删除');
        }
        store.deletedAt = new Date();
        await repo.save(store);
        const claimRepo = this.connection.getRepository(ctx, merchant_store_channel_entity_1.MerchantStoreChannel);
        const claims = await claimRepo.find({
            where: { storeId: Number(store.id), status: 'ACTIVE' },
        });
        if (claims.length > 0) {
            for (const claim of claims) {
                claim.status = 'REVOKED';
            }
            await claimRepo.save(claims);
            await this.syncMerchantClaimStatus(ctx, store.merchantId);
        }
        return true;
    }
    // ------------------------------------------------------------------
    // 认领关系 / 员工
    // ------------------------------------------------------------------
    /** 后台手工绑定门店：upsert 关系行并直接置为 ACTIVE（立即生效） */
    async claimStore(ctx, input) {
        var _a, _b, _c;
        const store = await this.getOrThrow(ctx, input.storeId);
        const storeId = Number(store.id);
        const channelId = Number(input.channelId);
        const repo = this.connection.getRepository(ctx, merchant_store_channel_entity_1.MerchantStoreChannel);
        let claim = await repo.findOne({ where: { storeId, channelId } });
        const now = new Date();
        if (!claim) {
            claim = repo.create({ storeId, channelId });
        }
        claim.role = (_b = (_a = input.role) !== null && _a !== void 0 ? _a : claim.role) !== null && _b !== void 0 ? _b : 'OWNER';
        claim.status = 'ACTIVE';
        claim.claimedAt = (_c = claim.claimedAt) !== null && _c !== void 0 ? _c : now;
        claim.verifiedAt = now;
        if (input.contractNo !== undefined) {
            claim.contractNo = input.contractNo;
        }
        if (ctx.activeUserId != null) {
            claim.claimedByUserId = Number(ctx.activeUserId);
        }
        const saved = await repo.save(claim);
        await this.syncMerchantClaimStatus(ctx, store.merchantId);
        return saved;
    }
    /** 撤销认领：只置状态 REVOKED，保留审计信息 */
    async revokeClaim(ctx, storeId, channelId) {
        const repo = this.connection.getRepository(ctx, merchant_store_channel_entity_1.MerchantStoreChannel);
        const claim = await repo.findOne({
            where: { storeId: Number(storeId), channelId: Number(channelId) },
        });
        if (!claim) {
            return false;
        }
        claim.status = 'REVOKED';
        await repo.save(claim);
        await this.syncMerchantClaimStatus(ctx, claim.storeId);
        return true;
    }
    async listClaims(ctx, storeId) {
        return this.connection.getRepository(ctx, merchant_store_channel_entity_1.MerchantStoreChannel).find({
            where: { storeId: Number(storeId) },
            order: { createdAt: 'ASC' },
        });
    }
    async upsertStaff(ctx, input) {
        const storeId = Number(input.storeId);
        const userId = Number(input.userId);
        await this.getOrThrow(ctx, storeId);
        const repo = this.connection.getRepository(ctx, merchant_store_staff_entity_1.MerchantStoreStaff);
        let staff = await repo.findOne({ where: { storeId, userId } });
        if (!staff) {
            staff = repo.create({ storeId, userId });
        }
        if (input.name !== undefined)
            staff.name = input.name;
        if (input.phone !== undefined)
            staff.phone = input.phone;
        if (input.role !== undefined) {
            if (!STAFF_ROLES.includes(input.role)) {
                throw new core_1.UserInputError(`无效的员工角色：${input.role}`);
            }
            staff.role = input.role;
        }
        if (input.status !== undefined) {
            if (!STAFF_STATUSES.includes(input.status)) {
                throw new core_1.UserInputError(`无效的员工状态：${input.status}`);
            }
            staff.status = input.status;
        }
        if (input.lastLoginAt !== undefined)
            staff.lastLoginAt = input.lastLoginAt;
        return repo.save(staff);
    }
    /** 移除门店员工关系（关系表硬删，不影响后台用户本体） */
    async removeStaff(ctx, storeId, userId) {
        await this.getOrThrow(ctx, storeId);
        const repo = this.connection.getRepository(ctx, merchant_store_staff_entity_1.MerchantStoreStaff);
        const staff = await repo.findOne({
            where: { storeId: Number(storeId), userId: Number(userId) },
        });
        if (!staff) {
            return false;
        }
        await repo.remove(staff);
        return true;
    }
    async listStoreStaff(ctx, storeId) {
        return this.connection.getRepository(ctx, merchant_store_staff_entity_1.MerchantStoreStaff).find({
            where: { storeId: Number(storeId) },
            order: { createdAt: 'ASC' },
        });
    }
    // ------------------------------------------------------------------
    // 内部辅助
    // ------------------------------------------------------------------
    async syncMerchantClaimStatus(ctx, merchantId) {
        const merchantRepo = this.connection.getRepository(ctx, merchant_entity_1.Merchant);
        const merchant = await merchantRepo.findOne({ where: { id: merchantId } });
        if (!merchant) {
            return;
        }
        // 统计口径按「未删除门店」维度：已删门店的认领不再计入商户认领状态
        const storeIds = (await this.connection
            .getRepository(ctx, merchant_store_entity_1.MerchantStore)
            .find({ where: { merchantId, deletedAt: (0, typeorm_1.IsNull)() } })).map(store => Number(store.id));
        const claimedCount = storeIds.length === 0
            ? 0
            : await this.connection
                .getRepository(ctx, merchant_store_channel_entity_1.MerchantStoreChannel)
                .createQueryBuilder('c')
                .where('c.status = :status', { status: 'ACTIVE' })
                .andWhere('c.storeId IN (:...storeIds)', { storeIds })
                .getCount();
        const next = claimedCount > 0 ? 'CLAIMED' : 'UNCLAIMED';
        if (merchant.claimStatus !== next) {
            merchant.claimStatus = next;
            await merchantRepo.save(merchant);
        }
    }
    normalizeIds(ids) {
        if (!Array.isArray(ids)) {
            return [];
        }
        return ids
            .map(id => Number(id))
            .filter(id => Number.isInteger(id) && id > 0);
    }
    compareBySortOrder(a, b) {
        var _a, _b, _c, _d;
        const sortDiff = ((_a = a.sortOrder) !== null && _a !== void 0 ? _a : 0) - ((_b = b.sortOrder) !== null && _b !== void 0 ? _b : 0);
        if (sortDiff !== 0) {
            return sortDiff;
        }
        return ((_c = b.weight) !== null && _c !== void 0 ? _c : 0) - ((_d = a.weight) !== null && _d !== void 0 ? _d : 0);
    }
    formatAddress(store) {
        return [store.province, store.city, store.district, store.street, store.addressLine, store.detail]
            .filter(part => part != null && String(part).trim().length > 0)
            .join('');
    }
    haversineDistance(lat1, lng1, lat2, lng2) {
        const R = 6371;
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLng = ((lng2 - lng1) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) ** 2 +
            Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
};
exports.MerchantStoreService = MerchantStoreService;
exports.MerchantStoreService = MerchantStoreService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], MerchantStoreService);
//# sourceMappingURL=merchant-store.service.js.map
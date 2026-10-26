import { Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { EntityNotFoundError, ID, LanguageCode, RequestContext, TransactionalConnection, UserInputError } from '@vendure/core';

import { StructuredBusinessHours, isOpenAt } from './business-hours';
import { localizeText } from './localize';
import { Merchant } from './merchant.entity';
import { MerchantStore } from './merchant-store.entity';
import { MerchantStoreChannel } from './merchant-store-channel.entity';
import { MerchantStoreStaff } from './merchant-store-staff.entity';

/** Shop 端公开的门店投影（字段与 GraphQL MerchantStorePublic 一一对应） */
export interface MerchantStorePublic {
    id: number;
    merchantId: number;
    merchantName: string;
    name: string;
    storeType: string;
    status: string;
    address: string;
    province: string | null;
    city: string | null;
    district: string | null;
    phoneNumber: string | null;
    backupPhone: string | null;
    businessHoursText: string | null;
    businessHours: string | null;
    coordinates: { lat: number; lng: number } | null;
    photos: string[];
    coverImage: string | null;
    notice: string | null;
    isOpenNow: boolean;
    distanceKm: number | null;
    mapPoiId: string | null;
}

export interface MerchantListOptions {
    skip?: number;
    take?: number;
    keyword?: string;
    status?: string;
    claimStatus?: string;
}

export interface MerchantStoreListOptions {
    skip?: number;
    take?: number;
    merchantId?: ID;
    city?: string;
    status?: string;
    keyword?: string;
}

export interface NearbyStoreOptions {
    lat?: number;
    lng?: number;
    city?: string;
    merchantId?: ID;
    limit?: number;
}

export interface ToPublicOptions {
    locale?: LanguageCode;
    lat?: number;
    lng?: number;
    distanceKm?: number | null;
    now?: Date;
}

export interface ClaimStoreInput {
    storeId: ID;
    channelId: ID;
    role?: string;
    contractNo?: string;
}

export interface UpsertStoreStaffInput {
    storeId: ID;
    userId: ID;
    name?: string;
    phone?: string;
    role?: string;
    status?: string;
    lastLoginAt?: Date | null;
}

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

function parseJsonValue(value: any): any {
    if (typeof value !== 'string') {
        return value;
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }
    try {
        return JSON.parse(trimmed);
    } catch {
        // 非合法 JSON 原样保留，交由 simple-json 序列化
        return value;
    }
}

function coerceJsonFields(input: Record<string, any>, keys: string[]): Record<string, any> {
    const copy: Record<string, any> = { ...input };
    for (const key of keys) {
        if (copy[key] !== undefined) {
            copy[key] = parseJsonValue(copy[key]);
        }
    }
    return copy;
}

function round1(value: number): number {
    return Math.round(value * 10) / 10;
}

@Injectable()
export class MerchantStoreService {
    constructor(private connection: TransactionalConnection) {}

    // ------------------------------------------------------------------
    // 查询（C 端公开视图）
    // ------------------------------------------------------------------

    /**
     * 附近 / 可售门店列表：
     * 过滤 enabled、isPublic、未删除、status != CLOSED；有坐标按 Haversine 距离升序并回填
     * distanceKm（保留 1 位小数），无坐标按 sortOrder 升序、weight 降序。
     */
    async findNearby(ctx: RequestContext, opts: NearbyStoreOptions = {}): Promise<MerchantStorePublic[]> {
        const qb = this.connection
            .getRepository(ctx, MerchantStore)
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

        const hasOrigin =
            typeof opts.lat === 'number' &&
            typeof opts.lng === 'number' &&
            Number.isFinite(opts.lat) &&
            Number.isFinite(opts.lng);

        let rows: Array<{ store: MerchantStore; distanceKm: number | null }>;
        if (hasOrigin) {
            rows = stores
                .map(store => {
                    const distanceKm =
                        store.lat != null && store.lng != null
                            ? round1(this.haversineDistance(opts.lat as number, opts.lng as number, store.lat, store.lng))
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
        } else {
            rows = stores
                .sort((a, b) => this.compareBySortOrder(a, b))
                .map(store => ({ store, distanceKm: null }));
        }

        if (typeof opts.limit === 'number' && opts.limit >= 0) {
            rows = rows.slice(0, opts.limit);
        }

        return rows.map(row =>
            this.toPublic(row.store, {
                lat: opts.lat,
                lng: opts.lng,
                distanceKm: row.distanceKm,
            }),
        );
    }

    /** 按 id 批量取公开可见门店（In 查询 + 公开过滤） */
    async findPublicByIds(ctx: RequestContext, ids: ID[]): Promise<MerchantStore[]> {
        const normalized = this.normalizeIds(ids);
        if (normalized.length === 0) {
            return [];
        }
        return this.connection
            .getRepository(ctx, MerchantStore)
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
    async findByIds(ctx: RequestContext, ids: ID[]): Promise<MerchantStore[]> {
        const normalized = this.normalizeIds(ids);
        if (normalized.length === 0) {
            return [];
        }
        return this.connection.getRepository(ctx, MerchantStore).find({
            where: { id: In(normalized) as any },
            relations: { merchant: true },
        });
    }

    async getOrThrow(ctx: RequestContext, id: ID): Promise<MerchantStore> {
        const store = await this.connection.getRepository(ctx, MerchantStore).findOne({
            where: { id: id as any },
            relations: { merchant: true },
        });
        if (!store) {
            throw new EntityNotFoundError('MerchantStore', id);
        }
        return store;
    }

    /** 门店当前是否营业：status=OPEN 且 acceptingOrders 且命中营业时间 */
    isOpenNow(store: MerchantStore, at?: Date): boolean {
        if (store.status !== 'OPEN' || !store.acceptingOrders) {
            return false;
        }
        return isOpenAt(
            {
                businessHours: store.businessHours as StructuredBusinessHours | null,
                businessHoursText: store.businessHoursText,
                timezone: store.timezone,
            },
            at,
        );
    }

    /**
     * 券核销前置校验：门店必须可用、公开、未删除、OPEN、接单、支持核销且在营业时间内，
     * 任一不满足抛 UserInputError（中文原因）。
     */
    async assertRedeemable(ctx: RequestContext, storeId: ID, at?: Date): Promise<MerchantStore> {
        const store = await this.getOrThrow(ctx, storeId);
        if (!store.enabled) {
            throw new UserInputError('门店已停用');
        }
        if (!store.isPublic) {
            throw new UserInputError('门店未公开');
        }
        if (store.deletedAt != null) {
            throw new UserInputError('门店已删除');
        }
        if (store.status !== 'OPEN') {
            throw new UserInputError(`门店当前状态为 ${store.status}，不可核销`);
        }
        if (!store.acceptingOrders) {
            throw new UserInputError('门店暂停接单');
        }
        if (!store.supportsRedemption) {
            throw new UserInputError('门店不支持核销');
        }
        if (!this.isOpenNow(store, at)) {
            throw new UserInputError('当前不在门店营业时间内');
        }
        return store;
    }

    /** 门店实体 → C 端公开投影 */
    toPublic(store: MerchantStore, opts: ToPublicOptions = {}): MerchantStorePublic {
        const locale = opts.locale ?? LanguageCode.zh_Hans;
        const coordinates =
            store.lat != null && store.lng != null
                ? { lat: Number(store.lat), lng: Number(store.lng) }
                : null;

        let distanceKm = opts.distanceKm ?? null;
        if (
            distanceKm == null &&
            coordinates &&
            typeof opts.lat === 'number' &&
            typeof opts.lng === 'number'
        ) {
            distanceKm = round1(this.haversineDistance(opts.lat, opts.lng, coordinates.lat, coordinates.lng));
        }

        const hours = store.businessHours as any;

        return {
            id: Number(store.id),
            merchantId: Number(store.merchantId),
            merchantName: store.merchant ? localizeText(store.merchant.name as any, locale, '') : '',
            name: localizeText(store.name as any, locale, ''),
            storeType: store.storeType,
            status: store.status,
            address: this.formatAddress(store),
            province: store.province ?? null,
            city: store.city ?? null,
            district: store.district ?? null,
            phoneNumber: store.phoneNumber ?? null,
            backupPhone: store.backupPhone ?? null,
            businessHoursText: store.businessHoursText ?? null,
            businessHours:
                hours == null ? null : typeof hours === 'string' ? hours : JSON.stringify(hours),
            coordinates,
            photos: Array.isArray(store.photos) ? store.photos : [],
            coverImage: store.coverImage ?? null,
            notice: store.notice == null ? null : localizeText(store.notice as any, locale, '') || null,
            isOpenNow: this.isOpenNow(store, opts.now),
            distanceKm,
            mapPoiId: store.mapPoiId ?? null,
        };
    }

    // ------------------------------------------------------------------
    // 商户 CRUD
    // ------------------------------------------------------------------

    async listMerchants(
        ctx: RequestContext,
        options: MerchantListOptions = {},
    ): Promise<{ items: Merchant[]; totalItems: number }> {
        const qb = this.connection.getRepository(ctx, Merchant).createQueryBuilder('m');
        if (options.keyword) {
            qb.andWhere(
                '(m.code LIKE :kw OR m.name LIKE :kw OR m.legalName LIKE :kw OR m.contactName LIKE :kw)',
                { kw: `%${options.keyword}%` },
            );
        }
        if (options.status) {
            qb.andWhere('m.status = :status', { status: options.status });
        }
        if (options.claimStatus) {
            qb.andWhere('m.claimStatus = :claimStatus', { claimStatus: options.claimStatus });
        }
        const [items, totalItems] = await qb
            .orderBy('m.createdAt', 'DESC')
            .skip(options.skip ?? 0)
            .take(options.take ?? 20)
            .getManyAndCount();
        return { items, totalItems };
    }

    async getMerchant(ctx: RequestContext, id: ID): Promise<Merchant | undefined> {
        const merchant = await this.connection.getRepository(ctx, Merchant).findOne({
            where: { id: id as any },
        });
        return merchant ?? undefined;
    }

    async createMerchant(ctx: RequestContext, input: any): Promise<Merchant> {
        const repo = this.connection.getRepository(ctx, Merchant);
        const code = String(input?.code ?? '').trim();
        if (!code) {
            throw new UserInputError('商户编码不能为空');
        }
        const exists = await repo.findOne({ where: { code } });
        if (exists) {
            throw new UserInputError('商户编码已存在');
        }
        const payload = coerceJsonFields({ ...input, code }, ['tags']);
        if (payload.name == null || payload.name === '') {
            payload.name = code;
        }
        return repo.save(repo.create(payload));
    }

    async updateMerchant(ctx: RequestContext, input: any): Promise<Merchant> {
        const repo = this.connection.getRepository(ctx, Merchant);
        const merchant = await repo.findOne({ where: { id: input?.id } });
        if (!merchant) {
            throw new UserInputError('商户不存在');
        }
        const { id, ...rest } = input ?? {};
        Object.assign(merchant, coerceJsonFields(rest, ['tags']));
        return repo.save(merchant);
    }

    // ------------------------------------------------------------------
    // 门店 CRUD
    // ------------------------------------------------------------------

    async listStores(
        ctx: RequestContext,
        options: MerchantStoreListOptions = {},
    ): Promise<{ items: MerchantStore[]; totalItems: number }> {
        const qb = this.connection
            .getRepository(ctx, MerchantStore)
            .createQueryBuilder('s')
            .leftJoinAndSelect('s.merchant', 'merchant');
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
            .skip(options.skip ?? 0)
            .take(options.take ?? 20)
            .getManyAndCount();
        return { items, totalItems };
    }

    async getStore(ctx: RequestContext, id: ID): Promise<MerchantStore | undefined> {
        const store = await this.connection.getRepository(ctx, MerchantStore).findOne({
            where: { id: id as any },
            relations: { merchant: true },
        });
        return store ?? undefined;
    }

    async createStore(ctx: RequestContext, input: any): Promise<MerchantStore> {
        const repo = this.connection.getRepository(ctx, MerchantStore);
        const code = String(input?.code ?? '').trim();
        if (!code) {
            throw new UserInputError('门店编码不能为空');
        }
        const merchantId = Number(input?.merchantId);
        if (!merchantId) {
            throw new UserInputError('门店必须归属商户');
        }
        const merchant = await this.connection.getRepository(ctx, Merchant).findOne({
            where: { id: merchantId as any },
        });
        if (!merchant) {
            throw new UserInputError('商户不存在');
        }
        const exists = await repo.findOne({ where: { code } });
        if (exists) {
            throw new UserInputError('门店编码已存在');
        }
        const payload = coerceJsonFields({ ...input, code, merchantId }, STORE_JSON_FIELDS);
        if (payload.name == null || payload.name === '') {
            payload.name = code;
        }
        return repo.save(repo.create(payload));
    }

    async updateStore(ctx: RequestContext, input: any): Promise<MerchantStore> {
        const repo = this.connection.getRepository(ctx, MerchantStore);
        const store = await repo.findOne({ where: { id: input?.id } });
        if (!store) {
            throw new UserInputError('门店不存在');
        }
        const { id, ...rest } = input ?? {};
        if (rest.merchantId != null) {
            rest.merchantId = Number(rest.merchantId);
        }
        Object.assign(store, coerceJsonFields(rest, STORE_JSON_FIELDS));
        /** 保存后重新读取以带上 merchant 关系，方便返回 MerchantStore 类型字段 */
        return repo.save(store);
    }

    // ------------------------------------------------------------------
    // 认领关系 / 员工
    // ------------------------------------------------------------------

    /** 后台手工绑定门店：upsert 关系行并直接置为 ACTIVE（立即生效） */
    async claimStore(ctx: RequestContext, input: ClaimStoreInput): Promise<MerchantStoreChannel> {
        const store = await this.getOrThrow(ctx, input.storeId);
        const storeId = Number(store.id);
        const channelId = Number(input.channelId);
        const repo = this.connection.getRepository(ctx, MerchantStoreChannel);
        let claim = await repo.findOne({ where: { storeId, channelId } });
        const now = new Date();
        if (!claim) {
            claim = repo.create({ storeId, channelId });
        }
        claim.role = input.role ?? claim.role ?? 'OWNER';
        claim.status = 'ACTIVE';
        claim.claimedAt = claim.claimedAt ?? now;
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
    async revokeClaim(ctx: RequestContext, storeId: ID, channelId: ID): Promise<boolean> {
        const repo = this.connection.getRepository(ctx, MerchantStoreChannel);
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

    async listClaims(ctx: RequestContext, storeId: ID): Promise<MerchantStoreChannel[]> {
        return this.connection.getRepository(ctx, MerchantStoreChannel).find({
            where: { storeId: Number(storeId) },
            order: { createdAt: 'ASC' },
        });
    }

    async upsertStaff(ctx: RequestContext, input: UpsertStoreStaffInput): Promise<MerchantStoreStaff> {
        const storeId = Number(input.storeId);
        const userId = Number(input.userId);
        await this.getOrThrow(ctx, storeId);
        const repo = this.connection.getRepository(ctx, MerchantStoreStaff);
        let staff = await repo.findOne({ where: { storeId, userId } });
        if (!staff) {
            staff = repo.create({ storeId, userId });
        }
        if (input.name !== undefined) staff.name = input.name;
        if (input.phone !== undefined) staff.phone = input.phone;
        if (input.role !== undefined) staff.role = input.role;
        if (input.status !== undefined) staff.status = input.status;
        if (input.lastLoginAt !== undefined) staff.lastLoginAt = input.lastLoginAt;
        return repo.save(staff);
    }

    async listStoreStaff(ctx: RequestContext, storeId: ID): Promise<MerchantStoreStaff[]> {
        return this.connection.getRepository(ctx, MerchantStoreStaff).find({
            where: { storeId: Number(storeId) },
            order: { createdAt: 'ASC' },
        });
    }

    // ------------------------------------------------------------------
    // 内部辅助
    // ------------------------------------------------------------------

    private async syncMerchantClaimStatus(ctx: RequestContext, merchantId: number): Promise<void> {
        const merchantRepo = this.connection.getRepository(ctx, Merchant);
        const merchant = await merchantRepo.findOne({ where: { id: merchantId as any } });
        if (!merchant) {
            return;
        }
        // 统计口径按门店维度：仅需判断该商户名下是否存在 ACTIVE 认领
        const storeIds = (
            await this.connection.getRepository(ctx, MerchantStore).find({ where: { merchantId } })
        ).map(store => Number(store.id));
        if (storeIds.length === 0) {
            return;
        }
        const claimedCount = await this.connection
            .getRepository(ctx, MerchantStoreChannel)
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

    private normalizeIds(ids: ID[] | undefined): number[] {
        if (!Array.isArray(ids)) {
            return [];
        }
        return ids
            .map(id => Number(id))
            .filter(id => Number.isInteger(id) && id > 0);
    }

    private compareBySortOrder(a: MerchantStore, b: MerchantStore): number {
        const sortDiff = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
        if (sortDiff !== 0) {
            return sortDiff;
        }
        return (b.weight ?? 0) - (a.weight ?? 0);
    }

    private formatAddress(store: MerchantStore): string {
        return [store.province, store.city, store.district, store.street, store.addressLine, store.detail]
            .filter(part => part != null && String(part).trim().length > 0)
            .join('');
    }

    private haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
        const R = 6371;
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLng = ((lng2 - lng1) * Math.PI) / 180;
        const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
}

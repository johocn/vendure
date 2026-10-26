import { ID, LanguageCode, RequestContext, TransactionalConnection } from '@vendure/core';
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
    coordinates: {
        lat: number;
        lng: number;
    } | null;
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
export declare class MerchantStoreService {
    private connection;
    constructor(connection: TransactionalConnection);
    /**
     * 附近 / 可售门店列表：
     * 过滤 enabled、isPublic、未删除、status != CLOSED；有坐标按 Haversine 距离升序并回填
     * distanceKm（保留 1 位小数），无坐标按 sortOrder 升序、weight 降序。
     */
    findNearby(ctx: RequestContext, opts?: NearbyStoreOptions): Promise<MerchantStorePublic[]>;
    /** 按 id 批量取公开可见门店（In 查询 + 公开过滤） */
    findPublicByIds(ctx: RequestContext, ids: ID[]): Promise<MerchantStore[]>;
    /** 按 id 批量取门店（后台全量语义，不做公开过滤） */
    findByIds(ctx: RequestContext, ids: ID[]): Promise<MerchantStore[]>;
    getOrThrow(ctx: RequestContext, id: ID): Promise<MerchantStore>;
    /** 门店当前是否营业：status=OPEN 且 acceptingOrders 且命中营业时间 */
    isOpenNow(store: MerchantStore, at?: Date): boolean;
    /**
     * 券核销前置校验：门店必须可用、公开、未删除、OPEN、接单、支持核销且在营业时间内，
     * 任一不满足抛 UserInputError（中文原因）。
     */
    assertRedeemable(ctx: RequestContext, storeId: ID, at?: Date): Promise<MerchantStore>;
    /** 门店实体 → C 端公开投影 */
    toPublic(store: MerchantStore, opts?: ToPublicOptions): MerchantStorePublic;
    listMerchants(ctx: RequestContext, options?: MerchantListOptions): Promise<{
        items: Merchant[];
        totalItems: number;
    }>;
    getMerchant(ctx: RequestContext, id: ID): Promise<Merchant | undefined>;
    createMerchant(ctx: RequestContext, input: any): Promise<Merchant>;
    updateMerchant(ctx: RequestContext, input: any): Promise<Merchant>;
    listStores(ctx: RequestContext, options?: MerchantStoreListOptions): Promise<{
        items: MerchantStore[];
        totalItems: number;
    }>;
    getStore(ctx: RequestContext, id: ID): Promise<MerchantStore | undefined>;
    createStore(ctx: RequestContext, input: any): Promise<MerchantStore>;
    updateStore(ctx: RequestContext, input: any): Promise<MerchantStore>;
    /** 后台手工绑定门店：upsert 关系行并直接置为 ACTIVE（立即生效） */
    claimStore(ctx: RequestContext, input: ClaimStoreInput): Promise<MerchantStoreChannel>;
    /** 撤销认领：只置状态 REVOKED，保留审计信息 */
    revokeClaim(ctx: RequestContext, storeId: ID, channelId: ID): Promise<boolean>;
    listClaims(ctx: RequestContext, storeId: ID): Promise<MerchantStoreChannel[]>;
    upsertStaff(ctx: RequestContext, input: UpsertStoreStaffInput): Promise<MerchantStoreStaff>;
    listStoreStaff(ctx: RequestContext, storeId: ID): Promise<MerchantStoreStaff[]>;
    private syncMerchantClaimStatus;
    private normalizeIds;
    private compareBySortOrder;
    private formatAddress;
    private haversineDistance;
}

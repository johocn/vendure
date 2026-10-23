import { ID, RequestContext } from '@vendure/core';
import { CampusConfigService } from './campus-config.service';
import { ErrandService } from './errand.service';
import { MerchantAdminService } from './merchant-admin.service';
import { ShippingProfileEnsureService } from './shipping-profile-ensure.service';
import { WaimaiStoreService } from './waimai-store.service';
export declare class CampusConfigAdminResolver {
    private config;
    private errand;
    private stores;
    private profileEnsure;
    private merchant;
    constructor(config: CampusConfigService, errand: ErrandService, stores: WaimaiStoreService, profileEnsure: ShippingProfileEnsureService, merchant: MerchantAdminService);
    campusZones(ctx: RequestContext): Promise<import("./campus-zone.entity").CampusZone[]>;
    campusBuildings(ctx: RequestContext, zoneId?: ID): Promise<import("./campus-building.entity").CampusBuilding[]>;
    campusConfig(ctx: RequestContext): Promise<import("./campus-fulfillment-config.entity").CampusFulfillmentConfig>;
    campusCreateZone(ctx: RequestContext, name: string, fee: number): Promise<any>;
    campusUpdateZone(ctx: RequestContext, id: ID, name?: string, fee?: number): Promise<import("./campus-zone.entity").CampusZone>;
    campusDeleteBuilding(ctx: RequestContext, id: ID): Promise<boolean>;
    campusCreateBuilding(ctx: RequestContext, name: string, zoneId: ID, detail?: string, lat?: number, lng?: number): Promise<any>;
    campusUpdateBuilding(ctx: RequestContext, id: ID, input: {
        name?: string;
        detail?: string;
        lat?: number | null;
        lng?: number | null;
    }): Promise<import("./campus-building.entity").CampusBuilding>;
    campusUpdateConfig(ctx: RequestContext, input: any): Promise<import("./campus-fulfillment-config.entity").CampusFulfillmentConfig>;
    campusCreateSlot(ctx: RequestContext, input: any): Promise<any>;
    campusUpdateSlot(ctx: RequestContext, id: number, input: any): Promise<import("./delivery-slot.entity").DeliverySlot>;
    campusSlots(ctx: RequestContext): Promise<import("./delivery-slot.entity").DeliverySlot[]>;
    /** R5 跑腿单：幂等创建 0 元载体商品（SKU 查重），C 端 addItemToOrder 用其 variantId */
    campusEnsureErrandProducts(ctx: RequestContext): Promise<{
        variantId: ID;
        sku: string;
    }>;
    /** 拾光达店铺配置：全店铺列表（跨租户视角） */
    campusStoreConfigs(ctx: RequestContext): Promise<import("./waimai-store.service").CampusStoreConfigWithChannel[]>;
    campusUpdateStoreConfig(ctx: RequestContext, channelId: ID, input: any): Promise<import("./waimai-store.service").CampusStoreConfigWithChannel>;
    /** 运营中心推送/重推外部快递（R2 待推送、R3 外部策略；复用商家侧同源实现，带渠道归属校验） */
    campusAdminDispatchExternal(ctx: RequestContext, orderId: ID, provider: string): Promise<{
        ok: boolean;
        already: boolean;
        thirdPartyNo: any;
        provider?: undefined;
    } | {
        ok: boolean;
        thirdPartyNo: any;
        provider: import("./route-matrix").ExternalProviderCode;
        already?: undefined;
    }>;
    /** 运营中心取消外部快递（换一家重推前，或运力失败回落大厅） */
    campusAdminCancelExternal(ctx: RequestContext, orderId: ID, reason?: string): Promise<{
        ok: boolean;
        skipped: boolean;
        reason?: undefined;
    } | {
        ok: boolean;
        reason: string | undefined;
        skipped?: undefined;
    }>;
    /** R2/R4 档案冲突治本：get-or-create 渠道合并默认配送档案（store-pickup+courier-delivery）并补绑未绑档案变体 */
    campusEnsureDefaultShippingProfile(ctx: RequestContext, channelId: ID): Promise<import("./shipping-profile-ensure.service").CampusEnsureProfileResult>;
}

import { ID, OrderService, RequestContext, TransactionalConnection } from '@vendure/core';
import { CampusConfigService } from './campus-config.service';
import { CampusNotifyService } from './campus-notify.service';
import { ExternalProviderCode } from './route-matrix';
import { HallService } from './hall.service';
import { ThirdPartyDeliveryService } from './third-party-delivery.service';
import { PrivacyNumberService } from './privacy-number.service';
export interface MerchantBoardLine {
    name: string;
    quantity: number;
    price: number;
}
export interface MerchantBoardOrder {
    id: string;
    code: string;
    createdAt: Date;
    total: number;
    shipping: number;
    building: string;
    zone: string;
    slotText: string;
    route: string;
    riderName: string | null;
    note: string | null;
    printedAt: Date | null;
    provider: string | null;
    thirdPartyNo: string | null;
    handoverCode: string | null;
    lines: MerchantBoardLine[];
}
export interface MerchantBoard {
    paused: boolean;
    merchantConfirmEnabled: boolean;
    printMode: 'off' | 'onPaid' | 'onAccepted';
    storeName: string;
    storePhone: string | null;
    pending: MerchantBoardOrder[];
    cooking: MerchantBoardOrder[];
    awaitingRider: MerchantBoardOrder[];
    delivering: MerchantBoardOrder[];
    pendingDispatch: MerchantBoardOrder[];
    thirdParty: MerchantBoardOrder[];
    ownedPool: MerchantBoardOrder[];
    ownedDispatched: MerchantBoardOrder[];
    merchantDelivering: MerchantBoardOrder[];
    scheduled: MerchantBoardOrder[];
    completedToday: number;
    completedTodayAmount: number;
}
/**
 * 商家接单工作台（admin-api，CampusMerchant 权限，渠道隔离 = 商家角色绑定渠道）。
 * 状态机（merchantConfirmEnabled 渠道）：支付 → pending_merchant（待商家接单）
 * → accepted（备餐中，campusMerchantAcceptOrder）→ open（出餐完成入大厅，
 * campusMerchantCookingDone）→ 骑手 grabbed/delivering → delivered。
 */
export declare class MerchantAdminService {
    private connection;
    private config;
    private hall;
    private notify;
    private thirdParty;
    private orderService;
    private privacy;
    constructor(connection: TransactionalConnection, config: CampusConfigService, hall: HallService, notify: CampusNotifyService, thirdParty: ThirdPartyDeliveryService, orderService: OrderService, privacy: PrivacyNumberService);
    /** 商家侧顾客联系方式（号码保护）：本渠道订单可查，开启后只返回脱敏/虚拟号 */
    customerContact(ctx: RequestContext, orderId: ID): Promise<import("./privacy-number.service").PrivacyContact>;
    board(ctx: RequestContext): Promise<MerchantBoard>;
    /** 商家接单确认：pending_merchant → accepted */
    acceptOrder(ctx: RequestContext, orderId: ID): Promise<{
        ok: boolean;
    }>;
    /** 商家拒单/商品缺货：接单前（pending_merchant）或备餐中（accepted）可拒，
     * 全额退款 + 取消订单（取消后由 Cancelled 转换自动脱厅/释放时段锁位）。
     * 退款幂等口径与 T4/异常处置一致：先查已退总额，仅退剩余部分。 */
    rejectOrder(ctx: RequestContext, orderId: ID, reason: string): Promise<{
        ok: boolean;
    }>;
    /** 出餐完成：按路线/承运分流（不再统一入抢单大厅） */
    cookingDone(ctx: RequestContext, orderId: ID): Promise<{
        ok: boolean;
    }>;
    /** 运营中心推送外部快递（选 dada / meituan） */
    dispatchExternal(ctx: RequestContext, orderId: ID, provider: ExternalProviderCode): Promise<{
        ok: boolean;
        already: boolean;
        thirdPartyNo: any;
        provider?: undefined;
    } | {
        ok: boolean;
        thirdPartyNo: any;
        provider: ExternalProviderCode;
        already?: undefined;
    }>;
    /** 取消外部快递（改推另一家 / 回落大厅前） */
    cancelExternal(ctx: RequestContext, orderId: ID, reason?: string): Promise<{
        ok: boolean;
        skipped: boolean;
        reason?: undefined;
    } | {
        ok: boolean;
        reason: string | undefined;
        skipped?: undefined;
    }>;
    /** 自营快递接单（R1 商户超时转自营 / R3 自营池） */
    acceptOwned(ctx: RequestContext, orderId: ID): Promise<{
        ok: boolean;
    }>;
    /** R1：商户把餐送到校园交接点 → 传信者接力 */
    markHandoverArrived(ctx: RequestContext, orderId: ID): Promise<{
        ok: boolean;
        done: boolean;
    }>;
    /** 自营快递送达（R1/R2 到交接点，R3 到学生） */
    markOwnedArrived(ctx: RequestContext, orderId: ID): Promise<{
        ok: boolean;
        done: boolean;
    }>;
    /** 营业开关：商家仅可切换本渠道 paused，其余配置仍归 CampusConfig 管理员 */
    setPaused(ctx: RequestContext, paused: boolean): Promise<{
        ok: boolean;
    }>;
    /** 小票打印回执：工作台打印成功后回写 waimaiPrintedAt（防重打 + 补打依据），不限订单状态 */
    markPrinted(ctx: RequestContext, orderId: ID): Promise<{
        ok: boolean;
    }>;
    /** 一键沽清：商品列表（本渠道），带售罄标记与规格数（搜索按名称模糊） */
    products(ctx: RequestContext, search?: string, skip?: number, take?: number): Promise<{
        items: any;
        total: number;
    }>;
    /** 沽清开关：售罄仍展示、不可加购；下单前置闸门二次校验 */
    setProductSoldOut(ctx: RequestContext, productId: ID, soldOut: boolean): Promise<{
        ok: boolean;
        soldOut: boolean;
    }>;
    /** 商品级打包费（分/件）：null 清除回落店铺配置；仅本渠道商品可改 */
    setProductPackingFee(ctx: RequestContext, productId: ID, packingFee: number | null): Promise<{
        ok: boolean;
        packingFee: number | null;
    }>;
    private assertAnyChannelOrder;
    private assertChannelOrder;
    private assertChannelOrderState;
    /** 组装商家视图 DTO：楼栋名批量查、骑手名批量查，不外泄 admin 内部字段 */
    private toDto;
}

import { ID, OrderService, RequestContext, TransactionalConnection } from '@vendure/core';
import { CampusConfigService } from './campus-config.service';
import { CampusNotifyService } from './campus-notify.service';
import { ExternalProviderCode } from './route-matrix';
import { HallService } from './hall.service';
import { ThirdPartyDeliveryService } from './third-party-delivery.service';
import { CloudPrintService } from './cloud-print.service';
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
    /** 打印通道（P1-4）：local=前端 C-Lodop；feie/yilianyun=服务端云打印 */
    printProvider: string;
    /** 云通道是否已配齐账号/设备/密钥（未配齐时前端提示去配置） */
    cloudPrintConfigured: boolean;
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
/** 商家自助经营：门店资料（营业时间存 Channel.customFields，与 C 端展示/下单闸门同源） */
export interface MerchantStoreProfile {
    storeName: string;
    businessHours: string | null;
    storeNotice: string | null;
    storePhone: string | null;
    paused: boolean;
    openNow: boolean;
}
/** KDS 出餐屏（P1-4）：一单一张票，按等待时长分级提醒 */
export interface KitchenTicketLine {
    name: string;
    quantity: number;
    addons: string[];
}
export interface KitchenTicket {
    id: string;
    code: string;
    stage: 'pending' | 'cooking';
    createdAt: Date;
    waitingMinutes: number;
    /** normal=<15min，warn=15-25min，late=>25min */
    urgency: 'normal' | 'warn' | 'late';
    zone: string;
    building: string;
    slotText: string;
    note: string | null;
    printedAt: Date | null;
    total: number;
    lines: KitchenTicketLine[];
}
export interface KitchenQueue {
    tickets: KitchenTicket[];
    pendingCount: number;
    cookingCount: number;
    lateCount: number;
    warnMinutes: number;
    lateMinutes: number;
}
/** 出餐屏超时阈值（分钟）：15 分钟预警、25 分钟催单 */
export declare const KDS_WARN_MINUTES = 15;
export declare const KDS_LATE_MINUTES = 25;
/** 经营数据分桶（分）：营业额=窗口内已送达订单实付合计；取消=窗口内取消单（全额退款口径） */
export interface MerchantRevenueBucket {
    orders: number;
    gross: number;
    avgTicket: number;
    cancelled: number;
    cancelledAmount: number;
}
export interface MerchantRevenueDay {
    date: string;
    orders: number;
    gross: number;
    cancelled: number;
    cancelledAmount: number;
}
export interface MerchantRevenue {
    today: MerchantRevenueBucket;
    last7: MerchantRevenueBucket;
    days: MerchantRevenueDay[];
    /** P3-2 导出用：近 30 日（含今日）逐日明细，口径与 days 完全一致 */
    days30: MerchantRevenueDay[];
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
    private cloud;
    constructor(connection: TransactionalConnection, config: CampusConfigService, hall: HallService, notify: CampusNotifyService, thirdParty: ThirdPartyDeliveryService, orderService: OrderService, privacy: PrivacyNumberService, cloud: CloudPrintService);
    /** 商家自助经营：门店资料（营业时间/公告/电话/营业状态） */
    storeProfile(ctx: RequestContext): Promise<MerchantStoreProfile>;
    /** 商家自助修改门店资料：营业时间走 Channel 自定义字段，公告/电话走履约配置白名单 */
    updateStore(ctx: RequestContext, input: {
        businessHours?: string | null;
        storeNotice?: string | null;
        storePhone?: string | null;
    }): Promise<MerchantStoreProfile>;
    /** 商家自助经营数据：今日/近 7 日（含今日）单量、营业额、客单价、取消退款；另附近 30 日逐日明细供导出 */
    revenue(ctx: RequestContext): Promise<MerchantRevenue>;
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
    /** 云打印一张小票（后端签名直连服务商）：成功即回写 printedAt */
    cloudPrint(ctx: RequestContext, orderId: ID): Promise<import("./cloud-print.service").CloudPrintResult>;
    /** 云打印连通性测试（不占用订单） */
    cloudPrintTest(ctx: RequestContext): Promise<import("./cloud-print.service").CloudPrintResult>;
    /** 最近云打印任务（排障） */
    printJobs(ctx: RequestContext, limit?: number): Promise<import("./cloud-print.service").CloudPrintJobRow[]>;
    /** KDS 出餐屏队列：待接单 + 备餐中（按支付先后出票，超时标红） */
    kitchenQueue(ctx: RequestContext): Promise<KitchenQueue>;
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
    /** 商品加料组（P1-2）：空数组=清除；清洗后再序列化，脏数据不入库 */
    setProductAddonGroups(ctx: RequestContext, productId: ID, rawGroups: unknown): Promise<{
        ok: boolean;
        addonGroups: string | null;
    }>;
    /** 商品套餐内容（P1-2）：传 null/空 items=清除（非套餐商品） */
    setProductCombo(ctx: RequestContext, productId: ID, rawCombo: unknown): Promise<{
        ok: boolean;
        combo: string | null;
    }>;
    /** 商品必须属于当前店铺渠道（越权防护：商家只能改本店商品） */
    private assertProductInChannel;
    private assertAnyChannelOrder;
    private assertChannelOrder;
    private assertChannelOrderState;
    /** 组装商家视图 DTO：楼栋名批量查、骑手名批量查，不外泄 admin 内部字段 */
    private toDto;
}

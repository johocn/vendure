import { ChannelService, RequestContextService, TransactionalConnection } from '@vendure/core';
import { WechatInboundMessage, WechatMessageEvent } from '@vendure/wechat-auth-plugin';
import { AddressBookService } from './address.service';
import { DeliveryGuardService } from './city/delivery-guard.service';
import { TenantRouterService } from './city/tenant-router.service';
import { CredentialService } from './credential.service';
import { CustomerBindingService } from './customer-binding.service';
import { GeoService } from './geo.service';
import { AssistantOrderService } from './order.service';
import { AssistantSearchService } from './search-adapter';
import { SessionService } from './session.service';
import { StoreLocatorService } from './store-locator.service';
import { SupportTicketService } from './support-ticket.service';
import { OutboundMessage, WechatShoppingAssistantOptions } from './types';
import { WechatSender } from './wechat-sender';
/**
 * 微信购物助手编排器：
 * 回调事件（WechatMessageEvent）→ 去重 → 意图识别 → 搜索/下单 → 客服消息回复。
 * 全链路异步执行且吞掉异常（回调 5 秒内已回 success，超时微信会重试，
 * 重复推送由 MsgId 去重表挡住）。
 */
export declare class AssistantService {
    private opts;
    private connection;
    private sessionService;
    private searchService;
    private orderService;
    private sender;
    private credentialService;
    private channelService;
    private requestContextService;
    private customerBinding;
    private addressBook;
    private geoService;
    private storeLocator;
    private supportTickets;
    private readonly deliveryGuard;
    private readonly tenantRouter;
    constructor(opts: WechatShoppingAssistantOptions, connection: TransactionalConnection, sessionService: SessionService, searchService: AssistantSearchService, orderService: AssistantOrderService, sender: WechatSender, credentialService: CredentialService, channelService: ChannelService, requestContextService: RequestContextService, customerBinding: CustomerBindingService, addressBook: AddressBookService, geoService: GeoService, storeLocator: StoreLocatorService, supportTickets: SupportTicketService, deliveryGuard: DeliveryGuardService, tenantRouter: TenantRouterService);
    onMessage(event: WechatMessageEvent): Promise<void>;
    /** 事件总线链路（本插件回调直连微信时用）：去重 → 决策 → 客服消息发送 */
    private handle;
    /**
     * 纯决策：意图识别 → 搜索/下单 → 组装出站消息（**不发送**）。
     * 两条链路共用：
     * ① 微信事件总线（本插件回调直连，handle() 负责发送）
     * ② HTTP 接口（strapi zhao-sso 回调转调 POST /wechat-assistant/handle，
     *    回复由 sso 的被动回复 XML 承担——受 5 秒窗口约束，本方法须快速返回）。
     * extra.boundPhone：sso 转调时附带的绑定用户手机号（路径 A：vendure 未绑定时自动建档，免输入）。
     * 返回 null = 无需回复（重复消息 / 非文本 / 未识别事件）。
     */
    processMessage(msg: WechatInboundMessage, extra?: {
        boundPhone?: string;
    }): Promise<OutboundMessage | null>;
    private handleFlowStep;
    /**
     * 管理态分支公共上下文：ctx + 顾客 + 选定地址 id；顾客失效返回 null（调用方回绑定引导）。
     * 地址已被删除（列表变动）时 addressId 仍在草稿中，由 getItem 返回 null 让调用方回列表态。
     */
    private withAddrCtx;
    /** addr_pick：回复编号选址（order → 下单确认 / manage → 操作菜单），0/「新增」进新增流程 */
    private onAddrPick;
    /** addr_op：管理态操作菜单（1 设默认 / 2 修改 / 3 删除 / 0 返回列表） */
    private onAddrOp;
    /** 「地址管理」入口：列地址簿 → addr_pick（manage 态） */
    private handleAddressManage;
    /** 「新增地址」入口：直接进新增地址文本状态（默认 manage 流程；下单流程传入保留 order 上下文） */
    private handleAddressAdd;
    /**
     * 微信「发送位置」消息：
     * - 空闲态：缓存定位结果（「新增地址」可直接复用），不改变会话状态；
     * - 地址录入态（awaiting_address / addr_new_text / addr_edit_text）：直接作为收货地址写入；
     * - 其他状态：提示先完成当前步骤，不打断流程。
     */
    private handleLocationMessage;
    /** 地理编码城市提示：已有定位结果时用其城市提升文本地址命中率 */
    private geoHint;
    /** 定位坐标 → 3km 内门店（熟店优先）；顾客未绑定/门店服务异常一律降级为空列表 */
    private matchStores;
    /** 「附近门店」：用最近一次定位坐标匹配（无定位先引导发送位置） */
    private handleNearbyStores;
    /** store_pick：回复「门店N」/「N」选定门店（记入草稿，供后续下单就近安排） */
    private onStorePick;
    /**
     * 客服卡片：先引导「在线留言」，不展示电话；同一会话第 3 次求助起附客服微信。
     * 多候选未选 → 「客服N」选择；同一门店 10 分钟内重复只回短提示。
     * 全程不改会话状态（用户下一次输入仍按原流程处理）。
     */
    private handleSupport;
    /** 渠道店铺域名 → 绝对地址（兼容只存 `host/path` 的配置） */
    private shopUrlOf;
    /**
     * 店铺名/简称识别：查询词等于店铺名（或去掉「店/超市」等后缀的主体）时回店铺信息。
     * 品类通用词（米/面/油/粮油…）不当作店名，避免挡住正常商品检索。
     */
    private matchShopQuery;
    /** 3km 门店列表项 → 客服联系方式（门店数据回查失败时兜底用） */
    private contactFromNearby;
    /** 「留言」入口：进入留言输入态，并记住当前流程状态（保存/取消后恢复） */
    private handleSupportNoteStart;
    /** 留言正文：校验长度 → 落库工单 → 恢复原流程状态 */
    private onSupportNote;
    /** 留言关联门店：最近客服门店 → 已选门店 → 3km 唯一候选 */
    private resolveSupportStore;
    /** 工单上下文摘要：当前这单商品/合计 + 城市（便于客服定位问题） */
    private supportSummary;
    /** 下单确认卡组装：草稿选址 → 回退默认地址 → 兜底空态引导；并按渠道配置选支付方式 */
    private orderConfirmCard;
    /** pay_pick：回复编号选支付方式 → 回下单确认；0 返回地址列表 */
    private onPayPick;
    /** 「支付方式」查询：按当前渠道配置列出（不改变会话状态） */
    private handlePaymentMethodsInfo;
    private handleSearch;
    private handleOrder;
    /**
     * 建单 + 结果文案（成功附支付链接；库存/变体/失败各回对应提示）。
     * addressId：对话选址的地址；未传时回退顾客默认地址（建档续下单场景——
     * 路径 A/B 刚建档的首地址即默认，直接落单保持零输入）。
     * 选定地址含收货人/电话，随 setShippingAddress 写入订单。
     */
    private placeOrder;
    /** 渠道展示名：装修 shopName → channel.code */
    private channelName;
    /** 渠道预计送达分钟数（未配置返回 null → 文案提示电话确认） */
    private channelDeliveryMinutes;
    /** MsgId 幂等：插入成功=首次处理；唯一键冲突=重复推送，直接跳过 */
    private claimDedup;
    private resolveChannelId;
    /** 地址流程目标渠道：优先复用既有会话的渠道（用户在该渠道搜的品），无会话按消息渠道 token */
    private resolveSessionChannelId;
    /**
     * 按会话存的渠道 ID 建 shop 上下文：
     * RequestContextService.create 的 channelOrToken 仅认 Channel 实体或 token 字符串，
     * 会话存的是渠道 ID，须先换实体；查不到时传 undefined 落默认渠道（与 resolveChannelId 兜底一致）。
     */
    private createShopCtx;
    private storefront;
    private loginUrl;
    /** 支付确认页：优先模板（hash 路由前端，如 `https://host/#/pkg-order/pages/payment?code={code}`） */
    private payUrl;
}

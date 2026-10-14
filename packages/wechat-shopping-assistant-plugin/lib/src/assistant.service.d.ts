import { ChannelService, RequestContextService, TransactionalConnection } from '@vendure/core';
import { WechatInboundMessage, WechatMessageEvent } from '@vendure/wechat-auth-plugin';
import { AddressBookService } from './address.service';
import { CredentialService } from './credential.service';
import { CustomerBindingService } from './customer-binding.service';
import { AssistantOrderService } from './order.service';
import { AssistantSearchService } from './search-adapter';
import { SessionService } from './session.service';
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
    constructor(opts: WechatShoppingAssistantOptions, connection: TransactionalConnection, sessionService: SessionService, searchService: AssistantSearchService, orderService: AssistantOrderService, sender: WechatSender, credentialService: CredentialService, channelService: ChannelService, requestContextService: RequestContextService, customerBinding: CustomerBindingService, addressBook: AddressBookService);
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
    /** 下单确认卡组装：草稿选址 → 回退默认地址 → 兜底空态引导 */
    private orderConfirmCard;
    private handleSearch;
    private handleOrder;
    /**
     * 建单 + 结果文案（成功附支付链接；库存/变体/失败各回对应提示）。
     * addressId：对话选址的地址；未传时回退顾客默认地址（建档续下单场景——
     * 路径 A/B 刚建档的首地址即默认，直接落单保持零输入）。
     * 选定地址含收货人/电话，随 setShippingAddress 写入订单。
     */
    private placeOrder;
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

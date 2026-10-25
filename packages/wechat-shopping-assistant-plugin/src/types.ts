import { WechatInboundMessage } from '@vendure/wechat-auth-plugin';

export interface WechatShoppingAssistantOptions {
    /** 店铺前端地址（商品页/收银台/登录页链接前缀），取 PUBLIC_STOREFRONT_URL */
    storefrontUrl: string;
    /** Vendure 资产公网域名（商品主图前缀），取 PUBLIC_ASSET_URL；未配置则卡片无图 */
    assetBaseUrl?: string;
    /**
     * 商品详情页 URL 模板，占位符 {slug}（替换时 encodeURIComponent）。
     * 默认（未配置）= `{storefrontUrl}/product/{slug}`；hash 路由前端（uni-app H5）
     * 配置形如 `https://host/#/pkg-product/pages/detail?slug={slug}`
     */
    productUrlTemplate?: string;
    /** 登录页 URL（无占位符，整串绝对地址）。默认 = `{storefrontUrl}/account/login` */
    loginUrlTemplate?: string;
    /** 支付确认页 URL 模板，占位符 {code}（订单号，encodeURIComponent）。默认 = `{storefrontUrl}/checkout/confirmation/{code}` */
    payUrlTemplate?: string;
    /** 搜索索引语言（kb-<locale>），默认 zh */
    searchLocale?: string;
    /** 会话内搜索结果有效期（分钟），默认 30 */
    sessionTtlMinutes?: number;
    /** 每次搜索返回并展示的商品数，默认 5 */
    searchLimit?: number;
    /**
     * 出站消息落盘模式：'api'（默认，调微信客服消息接口）| 'echo'
     * （不调微信 API，把出站 payload 打到日志，供本地冒烟）
     */
    outboundMode?: 'api' | 'echo';
}

export type WechatCredentials = { appId?: string; appSecret?: string };

export interface CardProduct {
    /** 会话内序号（从 1 开始），用户回复该编号下单 */
    index: number;
    productId: string;
    title: string;
    /** 单位：分 */
    price: number;
    thumbnail?: string;
    url?: string;
    slug?: string;
    /** 下单数量（「买2瓶酱油」类查询携带，默认 1） */
    quantity?: number;
}

/** 微信客服消息出站 payload（text / news 二选一） */
export type OutboundMessage =
    | { kind: 'text'; touser: string; content: string }
    | {
          kind: 'news';
          touser: string;
          articles: Array<{ title: string; description?: string; url?: string; picurl?: string }>;
      };

/**
 * 会话状态机状态：
 * - awaiting_phone / awaiting_address：未绑定建档补录（手机号 → 地址）
 * - addr_* / order_confirm：地址簿管理 + 下单选地址（方案 B 列表式逐轮问答）
 */
export type AssistantFlowState =
    | 'awaiting_phone'
    | 'awaiting_address'
    | 'addr_pick' // 等地址列表选择（draft.flow 区分下单/管理场景）
    | 'addr_op' // 管理态：已选地址，等操作（设默认/修改/删除/返回）
    | 'addr_edit_field' // 修改分支选择（1 改地址 / 2 改收货人电话）
    | 'addr_edit_text' // 等新地址文本
    | 'addr_edit_person' // 等新收货人/电话（「姓名 电话」）
    | 'addr_del_confirm' // 等删除确认（1 确认 / 0 返回）
    | 'addr_new_text' // 等新增地址文本
    | 'addr_new_phone' // 等电话选择（1 注册号 / 2 换新号）
    | 'addr_new_phone_text' // 等新号码
    | 'addr_new_default' // 等是否设默认（是/否）
    | 'store_pick' // 3km 门店列表选择（draft.nearbyStores）
    | 'support_note' // 等留言正文（≤200 字），保存后恢复 supportReturnState
    | 'pay_pick' // 下单选支付方式（draft.paymentMethods 编号选择）
    | 'order_confirm' // 下单二次确认（1 确认 / 0 重选地址 / 9 换支付方式）
    | null;

/** 状态机草稿：随 state 存取，各状态按需读写 */
export interface AssistantFlowDraft {
    /** 补录/新增地址中的手机号 */
    phone?: string | null;
    /** 待下单商品编号 */
    indices?: number[];
    /** 地址流程来源：order=下单选址 / manage=地址管理 */
    flow?: 'order' | 'manage' | null;
    /** 列表中选中的地址编号（1 起，用于回查列表项） */
    pickIndex?: number | null;
    /** 选中地址 id */
    pickAddressId?: string | null;
    /** 新增/修改中的地址文本 */
    pendingText?: string | null;
    /** 新增地址已确定的电话 */
    pendingPhone?: string | null;
    /** 地址定位结果（微信位置消息 / 地址文本地理编码），供保存地址时写入坐标 */
    geo?: AssistantAddressGeo | null;
    /** 最近一次识别到的城市（定位/地址地理编码），用于门店匹配 */
    city?: string | null;
    /** 最近一次匹配到的 3km 内门店（位置消息 /「附近门店」触发），「门店N」按序号回查 */
    nearbyStores?: NearbyStore[] | null;
    /** 用户选定的门店 id（会话内保留，下单确认时展示） */
    storeId?: string | null;
    /** 最近一次「客服」卡片下发时间（10 分钟内重复请求只回短提示） */
    supportAt?: number | null;
    /** 最近一次「客服」卡片对应的门店 id（判断是否同一门店重复请求） */
    supportStoreId?: string | null;
    /** 同一会话内「客服」求助次数（第 3 次起提供客服微信号） */
    supportAskCount?: number | null;
    /** 留言前所处的流程状态（留言保存后恢复，保证「每步」都不打断原流程） */
    supportReturnState?: AssistantFlowState;
    /** 选定的支付方式 code（下单确认用） */
    paymentMethodCode?: string | null;
    /** 会话内缓存的渠道支付方式列表（pay_pick 编号回查） */
    paymentMethods?: Array<{ code: string; name: string }> | null;
}

/** 3km 内门店（含距离与熟店标记），用于客服消息列表与选择 */
export interface NearbyStore {
    id: string;
    name: string;
    address: string;
    /** 直线距离（km，保留 1 位小数） */
    distanceKm: number;
    /** 熟店：该顾客历史订单选过该门店（自提/门店配送） */
    familiar: boolean;
    /** 门店客服电话（客服卡片用） */
    phoneNumber?: string | null;
    /** 营业时间（客服卡片用） */
    businessHours?: string | null;
}

/** 门店客服联系方式（按 id 回查，客服卡片用） */
export interface StoreContact {
    id: string;
    name: string;
    address: string;
    phoneNumber?: string | null;
    businessHours?: string | null;
}

/** 地址坐标 + 行政区（GCJ-02），写入 Address.latitude/longitude/city/province */
export interface AssistantAddressGeo {
    lat: number;
    lng: number;
    province?: string | null;
    city?: string | null;
    district?: string | null;
    /** 定位精度：door/poi/street/district/city（运行期使用，不落库） */
    level?: string | null;
}

/** 地址簿列表项（service 层聚合给文案构建用） */
export interface AddressBookItem {
    id: string;
    /** 序号（列表展示从 1 起） */
    index: number;
    fullName: string;
    phoneNumber: string;
    streetLine1: string;
    isDefault: boolean;
}

/** 入站消息的统一处理上下文 */
export interface InboundContext {
    message: WechatInboundMessage;
    credentials: WechatCredentials;
}

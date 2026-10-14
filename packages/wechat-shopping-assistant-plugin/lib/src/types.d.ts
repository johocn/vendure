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
export type WechatCredentials = {
    appId?: string;
    appSecret?: string;
};
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
export type OutboundMessage = {
    kind: 'text';
    touser: string;
    content: string;
} | {
    kind: 'news';
    touser: string;
    articles: Array<{
        title: string;
        description?: string;
        url?: string;
        picurl?: string;
    }>;
};
/** 入站消息的统一处理上下文 */
export interface InboundContext {
    message: WechatInboundMessage;
    credentials: WechatCredentials;
}

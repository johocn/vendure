import { ChannelService, Customer, CustomerService, RequestContext, TransactionalConnection, UserService } from '@vendure/core';
export type BindOrCreateOutcome = {
    status: 'ok';
    customer: Customer;
} | {
    status: 'phone_taken';
} | {
    status: 'error';
    message: string;
};
/**
 * 微信 openid ↔ 顾客绑定建档：
 * 路径 A（sso 已绑定用户免输入）：openid 在 vendure 无顾客时，用 sso 附带的手机号自动建档；
 * 路径 B（聊天内补录）：手机号 + 收货地址建档。
 * 建档模式对齐 cjk-plugin SsoAuthenticationStrategy.createFreshSsoUser /
 * wechat-auth-strategy（identifier = wechat_mp_<openid>，两处身份互认合并）。
 * 防冒领：手机号已被其他顾客注册（Customer.phoneNumber）时拒绝自动合并，回退 H5 登录验证。
 */
export declare class CustomerBindingService {
    private connection;
    private userService;
    private customerService;
    private channelService;
    constructor(connection: TransactionalConnection, userService: UserService, customerService: CustomerService, channelService: ChannelService);
    findCustomerByOpenid(openid: string): Promise<Customer | null>;
    /** 手机号查已有顾客（未删除；phoneNumber 为独立列，跨渠道） */
    private findCustomerByPhone;
    /**
     * 绑定或建档：
     * - openid 已绑顾客 → 直接返回 ok；
     * - 手机号已注册其他顾客 → phone_taken（回退 H5 登录，防止冒领他人账号）；
     * - 手机号顾客存在但未绑微信 → 写 wechatOpenid 绑定（sso 手机号与 H5 手机号登录同源互认）；
     * - 全新 → User(identifier=wechat_mp_<openid>) + Customer(phoneNumber) + 可选收货地址。
     */
    bindOrCreateCustomer(ctx: RequestContext, openid: string, phone: string, addressText?: string, geo?: {
        lat: number;
        lng: number;
        province?: string | null;
        city?: string | null;
    } | null): Promise<BindOrCreateOutcome>;
    /**
     * 保存本次输入的收货地址（建档与补绑定共用）；国家码缺失/无效时跳过，不阻塞下单。
     * 首地址即默认收货地址：下单选址列表 ⭐ 置顶，placeOrder 未选地址时兜底使用。
     */
    private saveInitialAddress;
}

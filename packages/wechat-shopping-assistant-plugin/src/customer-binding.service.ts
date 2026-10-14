import { Injectable } from '@nestjs/common';
import {
    ChannelService,
    Customer,
    CustomerService,
    isGraphQlErrorResult,
    Logger,
    RequestContext,
    TransactionalConnection,
    User,
    UserService,
} from '@vendure/core';

import { loggerCtx } from './constants';

export type BindOrCreateOutcome =
    | { status: 'ok'; customer: Customer }
    | { status: 'phone_taken' }
    | { status: 'error'; message: string };

/**
 * 微信 openid ↔ 顾客绑定建档：
 * 路径 A（sso 已绑定用户免输入）：openid 在 vendure 无顾客时，用 sso 附带的手机号自动建档；
 * 路径 B（聊天内补录）：手机号 + 收货地址建档。
 * 建档模式对齐 cjk-plugin SsoAuthenticationStrategy.createFreshSsoUser /
 * wechat-auth-strategy（identifier = wechat_mp_<openid>，两处身份互认合并）。
 * 防冒领：手机号已被其他顾客注册（Customer.phoneNumber）时拒绝自动合并，回退 H5 登录验证。
 */
@Injectable()
export class CustomerBindingService {
    constructor(
        private connection: TransactionalConnection,
        private userService: UserService,
        private customerService: CustomerService,
        private channelService: ChannelService,
    ) {}

    async findCustomerByOpenid(openid: string): Promise<Customer | null> {
        if (!openid) return null;
        const customer = await this.connection
            .getRepository(Customer)
            .findOne({ where: { customFields: { wechatOpenid: openid } } as any });
        return customer ?? null;
    }

    /** 手机号查已有顾客（未删除；phoneNumber 为独立列，跨渠道） */
    private async findCustomerByPhone(ctx: RequestContext, phone: string): Promise<Customer | null> {
        const customer = await this.connection
            .getRepository(ctx, Customer)
            .createQueryBuilder('c')
            .where('c.phoneNumber = :phone', { phone })
            .andWhere('c.deletedAt IS NULL')
            .getOne();
        return customer ?? null;
    }

    /**
     * 绑定或建档：
     * - openid 已绑顾客 → 直接返回 ok；
     * - 手机号已注册其他顾客 → phone_taken（回退 H5 登录，防止冒领他人账号）；
     * - 手机号顾客存在但未绑微信 → 写 wechatOpenid 绑定（sso 手机号与 H5 手机号登录同源互认）；
     * - 全新 → User(identifier=wechat_mp_<openid>) + Customer(phoneNumber) + 可选收货地址。
     */
    async bindOrCreateCustomer(
        ctx: RequestContext,
        openid: string,
        phone: string,
        addressText?: string,
    ): Promise<BindOrCreateOutcome> {
        try {
            // 1) 已绑定（并发/重复触发）→ 幂等成功
            const byOpenid = await this.findCustomerByOpenid(openid);
            if (byOpenid) return { status: 'ok', customer: byOpenid };

            // 2) 手机号已注册：同手机号顾客未绑微信 → 补绑定（同源手机号互认）；已绑其他微信 → 拒绝（防冒领）
            const byPhone = await this.findCustomerByPhone(ctx, phone);
            if (byPhone) {
                const boundOpenid = String((byPhone as any).customFields?.wechatOpenid ?? '');
                if (boundOpenid && boundOpenid !== openid) {
                    return { status: 'phone_taken' };
                }
                await this.customerService.update(ctx, {
                    id: byPhone.id,
                    ...(phone && !byPhone.phoneNumber ? { phoneNumber: phone } : {}),
                    customFields: { wechatOpenid: openid },
                } as any);
                if (ctx.channelId) {
                    await this.channelService.assignToChannels(ctx, Customer, byPhone.id, [ctx.channelId]);
                }
                Logger.info(`Customer bound to wechat openid by phone: customerId=${byPhone.id}`, loggerCtx);
                return { status: 'ok', customer: byPhone };
            }

            // 3) 全新建档：identifier 与 wechat-auth-strategy 的 H5 微信登录一致（wechat_mp_<openid>），
            //    后续 H5 微信登录按 identifier 找到同一账号，身份自然收敛
            const identifier = `wechat_mp_${openid}`;
            let user: any;
            const userResult = await this.userService.createCustomerUser(ctx, identifier);
            if (isGraphQlErrorResult(userResult)) {
                // 极端情况：H5 微信登录已建过该 identifier 但 customFields 写入失败 → 复用既有账号绑定
                const existingUser = await this.connection.getRepository(ctx, User).findOne({ where: { identifier } });
                if (!existingUser) {
                    return { status: 'error', message: String((userResult as any).message ?? 'create user failed') };
                }
                user = existingUser;
            } else {
                user = userResult;
            }

            const customer = await this.connection.getRepository(ctx, Customer).save(
                new Customer({
                    emailAddress: identifier,
                    firstName: '',
                    lastName: '',
                    phoneNumber: phone,
                    user,
                }),
            );
            if (ctx.channelId) {
                await this.channelService.assignToChannels(ctx, Customer, customer.id, [ctx.channelId]);
            }
            await this.customerService.update(ctx, {
                id: customer.id,
                customFields: { wechatOpenid: openid },
            } as any);

            // 4) 可选收货地址（路径 B 地址文本）；国家码缺失/无效时跳过（不阻塞下单）。
            //    首地址即默认收货地址：下单选址列表 ⭐ 置顶，placeOrder 未选地址时兜底使用
            if (addressText) {
                try {
                    await this.customerService.createAddress(ctx, customer.id, {
                        // fork 的 CreateAddressInput 字段为 streetLine1（上游为 streetLine）
                        streetLine1: addressText.slice(0, 250),
                        phoneNumber: phone,
                        countryCode: 'CN',
                        defaultShippingAddress: true,
                    } as any);
                } catch (e: any) {
                    Logger.warn(`Assistant bind: create address skipped: ${e?.message}`, loggerCtx);
                }
            }
            Logger.info(`Customer created via wechat assistant: customerId=${customer.id}`, loggerCtx);
            return { status: 'ok', customer };
        } catch (e: any) {
            Logger.error(`Assistant bindOrCreateCustomer failed: ${String(e?.message ?? e)}`, loggerCtx);
            return { status: 'error', message: String(e?.message ?? e) };
        }
    }
}

"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerBindingService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
/**
 * 微信 openid ↔ 顾客绑定建档：
 * 路径 A（sso 已绑定用户免输入）：openid 在 vendure 无顾客时，用 sso 附带的手机号自动建档；
 * 路径 B（聊天内补录）：手机号 + 收货地址建档。
 * 建档模式对齐 cjk-plugin SsoAuthenticationStrategy.createFreshSsoUser /
 * wechat-auth-strategy（identifier = wechat_mp_<openid>，两处身份互认合并）。
 * 防冒领：手机号已被其他顾客注册（Customer.phoneNumber）时拒绝自动合并，回退 H5 登录验证。
 */
let CustomerBindingService = class CustomerBindingService {
    constructor(connection, userService, customerService, channelService) {
        this.connection = connection;
        this.userService = userService;
        this.customerService = customerService;
        this.channelService = channelService;
    }
    async findCustomerByOpenid(openid) {
        if (!openid)
            return null;
        const customer = await this.connection
            .getRepository(core_1.Customer)
            .findOne({ where: { customFields: { wechatOpenid: openid } } });
        return customer !== null && customer !== void 0 ? customer : null;
    }
    /** 手机号查已有顾客（未删除；phoneNumber 为独立列，跨渠道） */
    async findCustomerByPhone(ctx, phone) {
        const customer = await this.connection
            .getRepository(ctx, core_1.Customer)
            .createQueryBuilder('c')
            .where('c.phoneNumber = :phone', { phone })
            .andWhere('c.deletedAt IS NULL')
            .getOne();
        return customer !== null && customer !== void 0 ? customer : null;
    }
    /**
     * 绑定或建档：
     * - openid 已绑顾客 → 直接返回 ok；
     * - 手机号已注册其他顾客 → phone_taken（回退 H5 登录，防止冒领他人账号）；
     * - 手机号顾客存在但未绑微信 → 写 wechatOpenid 绑定（sso 手机号与 H5 手机号登录同源互认）；
     * - 全新 → User(identifier=wechat_mp_<openid>) + Customer(phoneNumber) + 可选收货地址。
     */
    async bindOrCreateCustomer(ctx, openid, phone, addressText) {
        var _a, _b, _c, _d, _e;
        try {
            // 1) 已绑定（并发/重复触发）→ 幂等成功
            const byOpenid = await this.findCustomerByOpenid(openid);
            if (byOpenid)
                return { status: 'ok', customer: byOpenid };
            // 2) 手机号已注册：同手机号顾客未绑微信 → 补绑定（同源手机号互认）；已绑其他微信 → 拒绝（防冒领）
            const byPhone = await this.findCustomerByPhone(ctx, phone);
            if (byPhone) {
                const boundOpenid = String((_b = (_a = byPhone.customFields) === null || _a === void 0 ? void 0 : _a.wechatOpenid) !== null && _b !== void 0 ? _b : '');
                if (boundOpenid && boundOpenid !== openid) {
                    return { status: 'phone_taken' };
                }
                await this.customerService.update(ctx, Object.assign(Object.assign({ id: byPhone.id }, (phone && !byPhone.phoneNumber ? { phoneNumber: phone } : {})), { customFields: { wechatOpenid: openid } }));
                if (ctx.channelId) {
                    await this.channelService.assignToChannels(ctx, core_1.Customer, byPhone.id, [ctx.channelId]);
                }
                core_1.Logger.info(`Customer bound to wechat openid by phone: customerId=${byPhone.id}`, constants_1.loggerCtx);
                return { status: 'ok', customer: byPhone };
            }
            // 3) 全新建档：identifier 与 wechat-auth-strategy 的 H5 微信登录一致（wechat_mp_<openid>），
            //    后续 H5 微信登录按 identifier 找到同一账号，身份自然收敛
            const identifier = `wechat_mp_${openid}`;
            let user;
            const userResult = await this.userService.createCustomerUser(ctx, identifier);
            if ((0, core_1.isGraphQlErrorResult)(userResult)) {
                // 极端情况：H5 微信登录已建过该 identifier 但 customFields 写入失败 → 复用既有账号绑定
                const existingUser = await this.connection.getRepository(ctx, core_1.User).findOne({ where: { identifier } });
                if (!existingUser) {
                    return { status: 'error', message: String((_c = userResult.message) !== null && _c !== void 0 ? _c : 'create user failed') };
                }
                user = existingUser;
            }
            else {
                user = userResult;
            }
            const customer = await this.connection.getRepository(ctx, core_1.Customer).save(new core_1.Customer({
                emailAddress: identifier,
                firstName: '',
                lastName: '',
                phoneNumber: phone,
                user,
            }));
            if (ctx.channelId) {
                await this.channelService.assignToChannels(ctx, core_1.Customer, customer.id, [ctx.channelId]);
            }
            await this.customerService.update(ctx, {
                id: customer.id,
                customFields: { wechatOpenid: openid },
            });
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
                    });
                }
                catch (e) {
                    core_1.Logger.warn(`Assistant bind: create address skipped: ${e === null || e === void 0 ? void 0 : e.message}`, constants_1.loggerCtx);
                }
            }
            core_1.Logger.info(`Customer created via wechat assistant: customerId=${customer.id}`, constants_1.loggerCtx);
            return { status: 'ok', customer };
        }
        catch (e) {
            core_1.Logger.error(`Assistant bindOrCreateCustomer failed: ${String((_d = e === null || e === void 0 ? void 0 : e.message) !== null && _d !== void 0 ? _d : e)}`, constants_1.loggerCtx);
            return { status: 'error', message: String((_e = e === null || e === void 0 ? void 0 : e.message) !== null && _e !== void 0 ? _e : e) };
        }
    }
};
exports.CustomerBindingService = CustomerBindingService;
exports.CustomerBindingService = CustomerBindingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.UserService,
        core_1.CustomerService,
        core_1.ChannelService])
], CustomerBindingService);
//# sourceMappingURL=customer-binding.service.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WechatAuthenticationStrategy = void 0;
const graphql_tag_1 = require("graphql-tag");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
class WechatAuthenticationStrategy {
    constructor(options) {
        this.options = options;
        this.name = 'wechat';
    }
    async init(injector) {
        this.userService = injector.get(core_1.UserService);
        this.customerService = injector.get(core_1.CustomerService);
    }
    defineInputType() {
        return (0, graphql_tag_1.gql) `
            input WechatAuthInput {
                code: String!
                type: String!
            }
        `;
    }
    async authenticate(ctx, data) {
        const { code, type } = data;
        try {
            let openid;
            let userInfo = null;
            if (type === 'mp') {
                const mpResult = await this.getMpOpenidWithInfo(code);
                openid = mpResult.openid;
                userInfo = mpResult.userInfo;
            }
            else {
                openid = await this.getMiniOpenid(code);
            }
            if (!openid) {
                return '微信授权失败';
            }
            const identifier = type === 'mp' ? `wechat_mp_${openid}` : `wechat_mini_${openid}`;
            // Try to find existing user by identifier
            let user = await this.userService.getUserByEmailAddress(ctx, identifier);
            if (!user) {
                // Create new customer user
                const result = await this.userService.createCustomerUser(ctx, identifier);
                if ('identifier' in result) {
                    user = result;
                }
                else {
                    return false;
                }
            }
            // Update openid in custom fields
            try {
                const customer = await this.customerService.findOneByUserId(ctx, user.id);
                if (customer) {
                    const customFields = {};
                    if (type === 'mp') {
                        customFields.wechatOpenid = openid;
                        // If we got user info from snsapi_userinfo, update name
                        if (userInfo === null || userInfo === void 0 ? void 0 : userInfo.nickname) {
                            await this.customerService.update(ctx, {
                                id: customer.id,
                                firstName: userInfo.nickname,
                                customFields: { wechatOpenid: openid },
                            });
                        }
                        else {
                            await this.customerService.update(ctx, {
                                id: customer.id,
                                customFields: { wechatOpenid: openid },
                            });
                        }
                    }
                    else {
                        customFields.wechatMiniOpenid = openid;
                        await this.customerService.update(ctx, {
                            id: customer.id,
                            customFields: { wechatMiniOpenid: openid },
                        });
                    }
                }
            }
            catch (e) {
                core_1.Logger.warn(`Failed to update openid custom fields: ${e.message}`, constants_1.loggerCtx);
            }
            return user;
        }
        catch (e) {
            core_1.Logger.error(`WeChat auth failed: ${String(e.message)}`, constants_1.loggerCtx);
            return false;
        }
    }
    async getMpOpenidWithInfo(code) {
        var _a;
        const url = `https://api.weixin.qq.com/sns/oauth2/access_token` +
            `?appid=${this.options.appId}&secret=${this.options.appSecret}` +
            `&code=${code}&grant_type=authorization_code`;
        const response = await fetch(url);
        const data = (await response.json());
        if (!data.openid) {
            return { openid: '', userInfo: null };
        }
        // If scope was snsapi_userinfo, we can fetch user profile
        let userInfo = null;
        if (data.access_token && ((_a = data.scope) === null || _a === void 0 ? void 0 : _a.includes('snsapi_userinfo'))) {
            try {
                const infoUrl = `https://api.weixin.qq.com/sns/userinfo?access_token=${data.access_token}&openid=${data.openid}&lang=zh_CN`;
                const infoRes = await fetch(infoUrl);
                userInfo = await infoRes.json();
            }
            catch (e) {
                core_1.Logger.warn('Failed to fetch WeChat user info', constants_1.loggerCtx);
            }
        }
        return { openid: data.openid, userInfo };
    }
    async getMiniOpenid(code) {
        const appId = this.options.miniProgramAppId || this.options.appId;
        const secret = this.options.miniProgramAppSecret || this.options.appSecret;
        const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${secret}&js_code=${code}&grant_type=authorization_code`;
        const response = await fetch(url);
        const data = (await response.json());
        return data.openid;
    }
}
exports.WechatAuthenticationStrategy = WechatAuthenticationStrategy;
//# sourceMappingURL=wechat-auth-strategy.js.map
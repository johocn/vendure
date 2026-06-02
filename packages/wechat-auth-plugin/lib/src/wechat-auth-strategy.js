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
exports.WechatAuthenticationStrategy = void 0;
const graphql_tag_1 = require("graphql-tag");
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
let WechatAuthenticationStrategy = class WechatAuthenticationStrategy {
    constructor(options, userService) {
        this.options = options;
        this.userService = userService;
        this.name = 'wechat';
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
            if (type === 'mp') {
                openid = await this.getMpOpenid(code);
            }
            else {
                openid = await this.getMiniOpenid(code);
            }
            if (!openid) {
                return '微信授权失败';
            }
            const identifier = type === 'mp' ? `wechat_mp_${openid}` : `wechat_mini_${openid}`;
            const user = await this.userService.getUserByEmailAddress(ctx, identifier);
            if (user) {
                return user;
            }
            const result = await this.userService.createCustomerUser(ctx, identifier);
            if ('identifier' in result) {
                return result;
            }
            return false;
        }
        catch (e) {
            core_1.Logger.error(`WeChat auth failed: ${e.message}`, constants_1.loggerCtx);
            return false;
        }
    }
    async getMpOpenid(code) {
        const url = `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${this.options.appId}&secret=${this.options.appSecret}&code=${code}&grant_type=authorization_code`;
        const response = await fetch(url);
        const data = (await response.json());
        return data.openid;
    }
    async getMiniOpenid(code) {
        const appId = this.options.miniProgramAppId || this.options.appId;
        const secret = this.options.miniProgramAppSecret || this.options.appSecret;
        const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${secret}&js_code=${code}&grant_type=authorization_code`;
        const response = await fetch(url);
        const data = (await response.json());
        return data.openid;
    }
};
exports.WechatAuthenticationStrategy = WechatAuthenticationStrategy;
exports.WechatAuthenticationStrategy = WechatAuthenticationStrategy = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [Object, core_1.UserService])
], WechatAuthenticationStrategy);
//# sourceMappingURL=wechat-auth-strategy.js.map
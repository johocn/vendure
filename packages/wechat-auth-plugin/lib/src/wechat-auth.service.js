"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WechatAuthService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const crypto = __importStar(require("crypto"));
const constants_1 = require("./constants");
const constants_2 = require("./constants");
let WechatAuthService = class WechatAuthService {
    constructor(options) {
        this.options = options;
        this.accessTokenCache = null;
        this.ticketCache = null;
        this.accessTokenPromise = null;
        this.ticketPromise = null;
        this.REFRESH_BUFFER_SECONDS = 300; // Refresh 5 minutes before expiry
    }
    async getAccessToken() {
        if (this.accessTokenCache && Date.now() < this.accessTokenCache.expiresAt) {
            return this.accessTokenCache.token;
        }
        if (this.accessTokenPromise)
            return this.accessTokenPromise;
        this.accessTokenPromise = this.fetchAccessToken().finally(() => {
            this.accessTokenPromise = null;
        });
        return this.accessTokenPromise;
    }
    async getJsapiTicket() {
        if (this.ticketCache && Date.now() < this.ticketCache.expiresAt) {
            return this.ticketCache.token;
        }
        if (this.ticketPromise)
            return this.ticketPromise;
        this.ticketPromise = this.fetchJsapiTicket().finally(() => {
            this.ticketPromise = null;
        });
        return this.ticketPromise;
    }
    async generateJsapiSignature(url) {
        const ticket = await this.getJsapiTicket();
        const timestamp = Math.floor(Date.now() / 1000);
        const nonceStr = this.generateNonceStr();
        const raw = `jsapi_ticket=${ticket}&noncestr=${nonceStr}&timestamp=${timestamp}&url=${url}`;
        const signature = crypto.createHash('sha1').update(raw).digest('hex');
        return {
            appId: this.options.appId,
            timestamp,
            nonceStr,
            signature,
        };
    }
    async fetchAccessToken() {
        const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${this.options.appId}&secret=${this.options.appSecret}`;
        const response = await fetch(url);
        const data = (await response.json());
        if (data.access_token) {
            this.accessTokenCache = {
                token: data.access_token,
                expiresAt: Date.now() + (data.expires_in - this.REFRESH_BUFFER_SECONDS) * 1000,
            };
            core_1.Logger.info(`WeChat access_token refreshed, expires in ${data.expires_in}s`, constants_2.loggerCtx);
            return data.access_token;
        }
        core_1.Logger.error(`Failed to get access_token: ${JSON.stringify(data)}`, constants_2.loggerCtx);
        throw new Error('Failed to get WeChat access_token');
    }
    async fetchJsapiTicket() {
        const accessToken = await this.getAccessToken();
        const url = `https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token=${accessToken}&type=jsapi`;
        const response = await fetch(url);
        const data = (await response.json());
        if (data.ticket) {
            this.ticketCache = {
                token: data.ticket,
                expiresAt: Date.now() + (data.expires_in - this.REFRESH_BUFFER_SECONDS) * 1000,
            };
            core_1.Logger.info(`WeChat jsapi_ticket refreshed, expires in ${data.expires_in}s`, constants_2.loggerCtx);
            return data.ticket;
        }
        core_1.Logger.error(`Failed to get jsapi_ticket: ${JSON.stringify(data)}`, constants_2.loggerCtx);
        throw new Error('Failed to get WeChat jsapi_ticket');
    }
    generateNonceStr() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < 32; i++)
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        return result;
    }
};
exports.WechatAuthService = WechatAuthService;
exports.WechatAuthService = WechatAuthService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(constants_1.WECHAT_AUTH_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object])
], WechatAuthService);
//# sourceMappingURL=wechat-auth.service.js.map
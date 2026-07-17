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
exports.WechatMessageController = void 0;
const crypto = __importStar(require("crypto"));
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const cjk_plugin_1 = require("@vendure/cjk-plugin");
const plugin_1 = require("./plugin");
const wechat_message_crypto_1 = require("./wechat-message-crypto");
let WechatMessageController = class WechatMessageController {
    constructor(channelService) {
        this.channelService = channelService;
    }
    async getCredentials(channelId) {
        var _a, _b, _c;
        const ctx = core_1.RequestContext.empty();
        const channel = await this.channelService.findOne(ctx, channelId);
        if (!channel)
            throw new common_1.BadRequestException('Invalid channel');
        const override = (0, cjk_plugin_1.getAuthOverride)({ channel }, 'wechat');
        const token = (override === null || override === void 0 ? void 0 : override.token) || ((_a = plugin_1.WechatAuthPlugin.options) === null || _a === void 0 ? void 0 : _a.token);
        const encodingAESKey = (override === null || override === void 0 ? void 0 : override.encodingAESKey) || ((_b = plugin_1.WechatAuthPlugin.options) === null || _b === void 0 ? void 0 : _b.encodingAESKey);
        const appId = (override === null || override === void 0 ? void 0 : override.appId) || ((_c = plugin_1.WechatAuthPlugin.options) === null || _c === void 0 ? void 0 : _c.appId);
        if (!token || !encodingAESKey || !appId) {
            throw new common_1.BadRequestException('WECHAT_MESSAGE_CRYPTO_NOT_CONFIGURED');
        }
        return { token, encodingAESKey, appId };
    }
    async verify(query) {
        if (!query.channel || !query.signature || !query.timestamp || !query.nonce || !query.echostr) {
            throw new common_1.BadRequestException('Missing required query params');
        }
        const { token } = await this.getCredentials(query.channel);
        const expected = [token, query.timestamp, query.nonce].sort().join('');
        const hash = crypto.createHash('sha1').update(expected).digest('hex');
        if (hash !== query.signature)
            throw new common_1.BadRequestException('Signature mismatch');
        return query.echostr;
    }
    async receive(query, body) {
        if (!query.channel)
            throw new common_1.BadRequestException('Missing channel');
        const { token, encodingAESKey, appId } = await this.getCredentials(query.channel);
        const encrypted = body === null || body === void 0 ? void 0 : body.Encrypt;
        if (!encrypted) {
            return 'success';
        }
        if (query.encrypt_type === 'aes') {
            if (!query.msg_signature)
                throw new common_1.BadRequestException('Missing msg_signature');
            if (!(0, wechat_message_crypto_1.verifySignature)(token, query.timestamp, query.nonce, query.msg_signature, encrypted)) {
                throw new common_1.BadRequestException('Signature verification failed');
            }
            const xml = (0, wechat_message_crypto_1.decryptMessage)(token, encodingAESKey, appId, encrypted);
            // TODO: 解析 xml,路由到内部 handler(关注/菜单点击/消息等)
            return 'success';
        }
        return 'success';
    }
};
exports.WechatMessageController = WechatMessageController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], WechatMessageController.prototype, "verify", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], WechatMessageController.prototype, "receive", null);
exports.WechatMessageController = WechatMessageController = __decorate([
    (0, common_1.Controller)('wechat/message'),
    __metadata("design:paramtypes", [core_1.ChannelService])
], WechatMessageController);
//# sourceMappingURL=wechat-message.controller.js.map
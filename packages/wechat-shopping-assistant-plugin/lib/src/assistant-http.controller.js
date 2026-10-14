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
exports.AssistantHttpController = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const assistant_service_1 = require("./assistant.service");
const constants_1 = require("./constants");
/**
 * strapi zhao-sso 公众号回调转调接口：
 *   POST /shop-api/wechat-assistant/handle
 *   header: x-zhao-secret（与 strapi 端 ZHAO_SEARCH_SHARED_SECRET 同值）
 *   body:   { openid, text, msgId?, createTime?, channelToken? }
 *   返回:   { kind: 'text', content } | { kind: 'news', articles: [{title,description,pic_url,url}] }
 *           | { handled: false }（无需回复，sso 回 success）
 *
 * 回复由 sso 侧组装被动回复 XML（受微信 5 秒窗口约束，本接口必须快速返回）。
 * 微信直连回调链路（/shop-api/wechat/message → 事件总线 → 客服消息）保留为备选，
 * 公众号后台只能配一个回调 URL，生产走 sso 链路。
 */
let AssistantHttpController = class AssistantHttpController {
    constructor(assistantService) {
        this.assistantService = assistantService;
    }
    async handle(req, res) {
        var _a;
        const secret = process.env.ZHAO_SEARCH_SHARED_SECRET;
        if (!secret || req.headers['x-zhao-secret'] !== secret) {
            res.status(403).json({ handled: false, error: 'invalid secret' });
            return;
        }
        const body = (req.body || {});
        const openid = String(body.openid || body.fromUserName || '');
        const text = typeof body.text === 'string' ? body.text : '';
        if (!openid || !text) {
            res.status(400).json({ handled: false, error: 'openid and text are required' });
            return;
        }
        const msg = {
            channelToken: String(body.channelToken || ''),
            msgType: 'text',
            fromUserName: openid,
            toUserName: '',
            content: text,
            msgId: body.msgId != null ? String(body.msgId) : undefined,
            createTime: body.createTime != null ? Number(body.createTime) : undefined,
        };
        try {
            const out = await this.assistantService.processMessage(msg);
            if (!out) {
                res.json({ handled: false });
                return;
            }
            if (out.kind === 'news') {
                res.json({
                    kind: 'news',
                    articles: out.articles.map((a) => ({
                        title: a.title,
                        description: a.description,
                        pic_url: a.picurl,
                        url: a.url,
                    })),
                });
                return;
            }
            res.json({ kind: 'text', content: (_a = out.content) !== null && _a !== void 0 ? _a : '' });
        }
        catch (e) {
            core_1.Logger.error(`Assistant http handle failed: ${String(e)}`, constants_1.loggerCtx);
            res.json({ handled: false });
        }
    }
};
exports.AssistantHttpController = AssistantHttpController;
__decorate([
    (0, common_1.Post)('handle'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AssistantHttpController.prototype, "handle", null);
exports.AssistantHttpController = AssistantHttpController = __decorate([
    (0, common_1.Controller)('wechat-assistant'),
    __metadata("design:paramtypes", [assistant_service_1.AssistantService])
], AssistantHttpController);
//# sourceMappingURL=assistant-http.controller.js.map
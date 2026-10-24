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
exports.FeishuNotifyService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const feishu_card_service_1 = require("./feishu-card.service");
const feishu_client_1 = require("./feishu.client");
const feishu_templates_1 = require("./feishu.templates");
const loggerCtx = 'Feishu';
const DEDUPE_MS = 2 * 60000;
/**
 * 管理侧外发：订阅 notification-plugin 的 AdminNotifyEvent，把新订单/售后推到飞书群；
 * 新订单优先发订单卡片（尾号 + 按钮 + 话题归集），卡片失败再降级为文本；
 * 外卖插件内部的异常/超时也走 push() 复用同一条通道。
 * 未启用、未配置、发送失败一律静默降级，绝不阻塞订单主流程。
 */
let FeishuNotifyService = class FeishuNotifyService {
    constructor(client, cards) {
        this.client = client;
        this.cards = cards;
        this.recent = new Map();
    }
    async onAdminNotify(event) {
        var _a;
        if (!this.client.enabled)
            return;
        const dedupeKey = event.orderCode || event.orderId != null
            ? `${event.scene}:${event.orderId != null ? String(event.orderId) : event.orderCode}`
            : undefined;
        if (dedupeKey && this.isDuplicate(dedupeKey))
            return;
        if (event.scene === 'shop_new_order' && event.orderCode) {
            try {
                if (await this.cards.broadcastOrderCard(event.orderCode))
                    return;
            }
            catch (e) {
                core_1.Logger.warn(`新订单卡片发送失败，降级文本：${(_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e}`, loggerCtx);
            }
        }
        const link = event.link
            ? `${process.env.ADMIN_UI_BASE_URL || 'https://e.joho.cn'}${event.link.startsWith('/') ? '' : '/'}${event.link}`
            : undefined;
        const text = (0, feishu_templates_1.formatPush)({
            scene: event.scene,
            title: event.title,
            content: event.content,
            orderCode: event.orderCode,
            link,
            at: Date.now(),
        });
        await this.deliver(text, event.scene);
    }
    /** 内部事件（异常/超时/支付取消）直接推群；按业务键 5 分钟去重 */
    async push(scene, dedupeKey, text) {
        if (!this.client.enabled)
            return;
        if (dedupeKey && this.isDuplicate(`${scene}:${dedupeKey}`))
            return;
        await this.deliver(text, scene);
    }
    async pushEvent(scene, title, content, orderCode, dedupeKey) {
        // 缺省键必须带事件标题：同一订单 2 分钟内可能连发多个不同事件（如取货超时告警 + 回厅），
        // 只用 orderCode 会把后到的那条吞掉。显式传键的调用方保持原语义。
        const key = dedupeKey !== null && dedupeKey !== void 0 ? dedupeKey : (orderCode ? `${orderCode}:${title}` : undefined);
        await this.push(scene, key, (0, feishu_templates_1.formatPush)({ scene, title, content, orderCode, at: Date.now() }));
    }
    async deliver(text, scene) {
        var _a;
        try {
            const ok = await this.client.broadcast(text);
            if (!ok)
                core_1.Logger.warn(`飞书推送未送达 scene=${scene}`, loggerCtx);
        }
        catch (e) {
            core_1.Logger.warn(`飞书推送异常 scene=${scene}: ${(_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e}`, loggerCtx);
        }
    }
    isDuplicate(key) {
        const now = Date.now();
        for (const [k, at] of this.recent) {
            if (now - at > DEDUPE_MS)
                this.recent.delete(k);
        }
        const seen = this.recent.get(key);
        if (seen && now - seen <= DEDUPE_MS)
            return true;
        this.recent.set(key, now);
        return false;
    }
};
exports.FeishuNotifyService = FeishuNotifyService;
exports.FeishuNotifyService = FeishuNotifyService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [feishu_client_1.FeishuClient,
        feishu_card_service_1.FeishuCardService])
], FeishuNotifyService);
//# sourceMappingURL=feishu-notify.service.js.map
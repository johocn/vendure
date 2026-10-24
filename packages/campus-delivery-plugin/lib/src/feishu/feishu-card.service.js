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
exports.FeishuCardService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const campus_building_entity_1 = require("../campus-building.entity");
const feishu_client_1 = require("./feishu.client");
const feishu_templates_1 = require("./feishu.templates");
const loggerCtx = 'Feishu';
/**
 * 订单卡片：数据只从现有 order / campus_building / customer 读，不建表、不落索引。
 * 短码在展示层计算，完整单号只放在按钮 value 里（点击事件原样带回，引用回复也能回读到）。
 *
 * P2.1 告警合并缓存：
 * - codeToMessage   → orderCode → { chatId: messageId }        （发卡片时写，用于 PATCH 刷新）
 * - codeToAlerts    → orderCode → [{ dedupeKey, alertText }]   （appendAlert 时写，buildCard 重建卡片时读）
 *
 * 关键：appendAlert 先写入 codeToAlerts → 再调 buildCard（模板渲染时带 alerts 数组）→ updateCard PATCH 整卡。
 *       这样运营点按钮 handler 调 cards.refresh → buildCard 时 alerts 还在 Map 里 → 告警行不会被刷新覆盖丢失。
 */
let FeishuCardService = class FeishuCardService {
    constructor(client, connection) {
        this.client = client;
        this.connection = connection;
        /** orderCode → { chatId: messageId } */
        this.codeToMessage = new Map();
        /** orderCode → [{ dedupeKey, alertText }] 进程内告警历史，buildCard 重建卡片时注入 */
        this.codeToAlerts = new Map();
    }
    /** 告警合并入口：pushEvent 带 orderCode 时先尝试 PATCH 卡片追加告警，返回是否成功 */
    async appendAlert(orderCode, alertText, dedupeKey) {
        var _a;
        const mapping = this.codeToMessage.get(orderCode);
        if (!mapping)
            return false;
        // Bug 2 修复：去重用 dedupeKey 精确匹配（dispatch 传的如 rider_pick_alert:CODE），
        // 不是 title 文本。相同 dedupeKey + 相同 text 才跳过；相同 dedupeKey 但 text 不同（如 13→14min）追加新行。
        const existing = (_a = this.codeToAlerts.get(orderCode)) !== null && _a !== void 0 ? _a : [];
        const matched = dedupeKey
            ? existing.find(a => a.key === dedupeKey && a.text === alertText)
            : existing.find(a => a.text === alertText);
        if (matched)
            return true; // 已在 Map 里，buildCard 会带上
        existing.push({ key: dedupeKey !== null && dedupeKey !== void 0 ? dedupeKey : alertText, text: alertText });
        // 最多保留 10 条（同单告警不可能超过这个数，超出丢最老的）
        if (existing.length > 10)
            existing.splice(0, existing.length - 10);
        this.codeToAlerts.set(orderCode, existing);
        // 如果已经超过 20 条告警（异常反复触发），手动触发一轮 GC——进程内不能无限增
        if (this.codeToAlerts.size > 200)
            this.gcAlerts();
        let anyOk = false;
        for (const [chatId, messageId] of Object.entries(mapping)) {
            try {
                const card = await this.buildCard(orderCode);
                if (!card)
                    continue;
                const ok = await this.client.updateCard(messageId, card);
                if (ok)
                    anyOk = true;
            }
            catch ( /* 单群失败不影响其他群 */_b) { /* 单群失败不影响其他群 */ }
        }
        return anyOk;
    }
    /** 显式清掉某单的告警行（异常终态改 exception_final 时由 notify 层调用） */
    clearAlerts(orderCode) {
        this.codeToAlerts.delete(orderCode);
    }
    gcAlerts() {
        const now = Date.now();
        // 只清已经超过 24h 没更新的 order 的 alerts
        // 但我们没存时间戳，简单点：超过 500 就清前半（FIFO 近似）
        if (this.codeToAlerts.size > 500) {
            let n = 0;
            for (const k of this.codeToAlerts.keys()) {
                this.codeToAlerts.delete(k);
                n++;
                if (n >= Math.floor(this.codeToAlerts.size / 2))
                    break;
            }
        }
        void now; // silence unused
    }
    /** 读现有表组装卡片所需数据（与文本查单共用同一份视图） */
    async loadOrderView(code) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
        if (!code)
            return null;
        const order = await this.connection.rawConnection.getRepository(core_1.Order).findOne({
            where: { code },
            relations: ['channels'],
        });
        if (!order)
            return null;
        const cf = order.customFields;
        let building = null;
        if (cf === null || cf === void 0 ? void 0 : cf.buildingId) {
            const b = await this.connection.rawConnection.getRepository(campus_building_entity_1.CampusBuilding).findOne({
                where: { id: String(cf.buildingId) },
            });
            building = (_a = b === null || b === void 0 ? void 0 : b.name) !== null && _a !== void 0 ? _a : null;
        }
        let riderName = null;
        if (cf === null || cf === void 0 ? void 0 : cf.deliveryStaffId) {
            const rider = await this.connection.rawConnection.getRepository('Customer').findOne({
                where: { id: Number(cf.deliveryStaffId) },
            });
            riderName = (_c = (_b = rider === null || rider === void 0 ? void 0 : rider.customFields) === null || _b === void 0 ? void 0 : _b.riderRealName) !== null && _c !== void 0 ? _c : null;
        }
        const reportedAt = (cf === null || cf === void 0 ? void 0 : cf.exceptionReportedAt) ? new Date(cf.exceptionReportedAt).getTime() : NaN;
        // Bug 1 修复：从 codeToAlerts Map 读告警历史注入 views，这样 buildCard → 按钮 refresh 重建时告警行保留
        const alerts = (_e = (_d = this.codeToAlerts.get(code)) === null || _d === void 0 ? void 0 : _d.map(a => a.text)) !== null && _e !== void 0 ? _e : [];
        return {
            code: order.code,
            store: (_h = (_g = (_f = order.channels) === null || _f === void 0 ? void 0 : _f[0]) === null || _g === void 0 ? void 0 : _g.code) !== null && _h !== void 0 ? _h : '',
            orderState: String(order.state),
            hallStatus: (_j = cf === null || cf === void 0 ? void 0 : cf.hallStatus) !== null && _j !== void 0 ? _j : null,
            deliveryStatus: (_k = cf === null || cf === void 0 ? void 0 : cf.deliveryStatus) !== null && _k !== void 0 ? _k : null,
            route: (_l = cf === null || cf === void 0 ? void 0 : cf.fulfillmentRoute) !== null && _l !== void 0 ? _l : null,
            riderName,
            building,
            zone: (_m = cf === null || cf === void 0 ? void 0 : cf.campusZone) !== null && _m !== void 0 ? _m : null,
            slotText: (_o = cf === null || cf === void 0 ? void 0 : cf.deliverySlotText) !== null && _o !== void 0 ? _o : null,
            total: order.total,
            exceptionType: (_p = cf === null || cf === void 0 ? void 0 : cf.exceptionType) !== null && _p !== void 0 ? _p : null,
            exceptionNote: (_q = cf === null || cf === void 0 ? void 0 : cf.exceptionNote) !== null && _q !== void 0 ? _q : null,
            exceptionMinutes: Number.isNaN(reportedAt) ? null : Math.round((Date.now() - reportedAt) / 60000),
            createdAt: new Date(order.createdAt).getTime(),
            at: Date.now(),
            alerts,
        };
    }
    async buildCard(code) {
        const view = await this.loadOrderView(code);
        return view ? (0, feishu_templates_1.buildOrderCard)(view) : null;
    }
    /** 发订单卡片，返回 message_id（用于后续原地刷新） */
    async sendOrderCard(chatId, code) {
        const card = await this.buildCard(code);
        if (!card)
            return null;
        return this.client.sendCard(chatId, card);
    }
    /** 新订单卡片：发到所有已映射群；一个都没发出去时返回 false，让调用方降级文本 */
    async broadcastOrderCard(code) {
        var _a, _b, _c;
        if (!this.client.enabled)
            return false;
        const card = await this.buildCard(code);
        if (!card)
            return false;
        const chats = Object.keys((_c = (_b = (_a = this.client.cfg) === null || _a === void 0 ? void 0 : _a.settings) === null || _b === void 0 ? void 0 : _b.chats) !== null && _c !== void 0 ? _c : {});
        const msgMap = {};
        let ok = false;
        for (const chatId of chats) {
            const mid = await this.client.sendCard(chatId, card);
            if (mid) {
                msgMap[chatId] = mid;
                ok = true;
            }
        }
        if (ok)
            this.codeToMessage.set(code, msgMap);
        return ok;
    }
    /** 外部写入 message_id（如用户查单触发 sendOrderCard 后） */
    trackMessage(code, chatId, messageId) {
        var _a;
        const cur = (_a = this.codeToMessage.get(code)) !== null && _a !== void 0 ? _a : {};
        cur[chatId] = messageId;
        this.codeToMessage.set(code, cur);
    }
    /** 按钮操作后原地刷新卡片（失败不抛错，由调用方决定是否补文本） */
    async refresh(messageId, code) {
        var _a;
        if (!messageId)
            return false;
        const card = await this.buildCard(code); // loadOrderView 里会从 codeToAlerts 注入 alerts → Bug 1 修复
        if (!card)
            return false;
        try {
            return await this.client.updateCard(messageId, card);
        }
        catch (e) {
            core_1.Logger.warn(`飞书卡片刷新失败 message=${messageId}: ${(_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e}`, loggerCtx);
            return false;
        }
    }
};
exports.FeishuCardService = FeishuCardService;
exports.FeishuCardService = FeishuCardService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [feishu_client_1.FeishuClient,
        core_1.TransactionalConnection])
], FeishuCardService);
//# sourceMappingURL=feishu-card.service.js.map
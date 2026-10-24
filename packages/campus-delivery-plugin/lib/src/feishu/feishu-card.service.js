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
 */
let FeishuCardService = class FeishuCardService {
    constructor(client, connection) {
        this.client = client;
        this.connection = connection;
    }
    /** 读现有表组装卡片所需数据（与文本查单共用同一份视图） */
    async loadOrderView(code) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
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
        return {
            code: order.code,
            store: (_f = (_e = (_d = order.channels) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.code) !== null && _f !== void 0 ? _f : '',
            orderState: String(order.state),
            hallStatus: (_g = cf === null || cf === void 0 ? void 0 : cf.hallStatus) !== null && _g !== void 0 ? _g : null,
            deliveryStatus: (_h = cf === null || cf === void 0 ? void 0 : cf.deliveryStatus) !== null && _h !== void 0 ? _h : null,
            route: (_j = cf === null || cf === void 0 ? void 0 : cf.fulfillmentRoute) !== null && _j !== void 0 ? _j : null,
            riderName,
            building,
            zone: (_k = cf === null || cf === void 0 ? void 0 : cf.campusZone) !== null && _k !== void 0 ? _k : null,
            slotText: (_l = cf === null || cf === void 0 ? void 0 : cf.deliverySlotText) !== null && _l !== void 0 ? _l : null,
            total: order.total,
            exceptionType: (_m = cf === null || cf === void 0 ? void 0 : cf.exceptionType) !== null && _m !== void 0 ? _m : null,
            exceptionNote: (_o = cf === null || cf === void 0 ? void 0 : cf.exceptionNote) !== null && _o !== void 0 ? _o : null,
            exceptionMinutes: Number.isNaN(reportedAt) ? null : Math.round((Date.now() - reportedAt) / 60000),
            createdAt: new Date(order.createdAt).getTime(),
            at: Date.now(),
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
        if (!this.client.enabled)
            return false;
        const card = await this.buildCard(code);
        if (!card)
            return false;
        return this.client.broadcastCard(card);
    }
    /** 按钮操作后原地刷新卡片（失败不抛错，由调用方决定是否补文本） */
    async refresh(messageId, code) {
        var _a;
        if (!messageId)
            return false;
        const card = await this.buildCard(code);
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
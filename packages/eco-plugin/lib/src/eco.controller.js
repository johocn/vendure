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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EcoController = void 0;
const common_1 = require("@nestjs/common");
const eco_reporter_service_1 = require("./eco-reporter.service");
/** 前端可上报的生态行为（purchase/distribute 由内部钩子触发，不开放端点） */
const FORWARD_ACTIONS = ['view_product', 'view_price'];
/**
 * nshop 前端浏览类行为上报端点：POST /eco/events
 * body: { "action": "view_product" | "view_price", "ssoId": "12", "targetId": "1024", "extra": {} }
 * 校验通过后内部完成签名并转发到游戏服务器（fire-and-forget），本端点立即返回 { ok: true }。
 */
let EcoController = class EcoController {
    constructor(reporter) {
        this.reporter = reporter;
    }
    report(body) {
        const action = body === null || body === void 0 ? void 0 : body.action;
        const ssoId = body === null || body === void 0 ? void 0 : body.ssoId;
        const targetId = body === null || body === void 0 ? void 0 : body.targetId;
        if (!FORWARD_ACTIONS.includes(action) || !ssoId || !targetId) {
            throw new common_1.BadRequestException(`action 必须是 ${FORWARD_ACTIONS.join('/')}，且 ssoId/targetId 必填`);
        }
        this.reporter.report(String(ssoId), action, String(targetId), body === null || body === void 0 ? void 0 : body.extra);
        return { ok: true };
    }
};
exports.EcoController = EcoController;
__decorate([
    (0, common_1.Post)('events'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Object)
], EcoController.prototype, "report", null);
exports.EcoController = EcoController = __decorate([
    (0, common_1.Controller)('eco'),
    __metadata("design:paramtypes", [eco_reporter_service_1.EcoReporter])
], EcoController);
//# sourceMappingURL=eco.controller.js.map
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
exports.WechatShoppingSession = void 0;
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
/**
 * 微信购物助手会话：openid 维度保存最近一次搜索结果（编号 → 商品）。
 * 用户回复「买N」时按编号回查本表下单；过期需重新搜索。
 */
let WechatShoppingSession = class WechatShoppingSession extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.WechatShoppingSession = WechatShoppingSession;
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 64 }),
    __metadata("design:type", String)
], WechatShoppingSession.prototype, "openid", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 64 }),
    __metadata("design:type", String)
], WechatShoppingSession.prototype, "channelId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json' }),
    __metadata("design:type", Array)
], WechatShoppingSession.prototype, "results", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", Object)
], WechatShoppingSession.prototype, "query", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 32, nullable: true }),
    __metadata("design:type", Object)
], WechatShoppingSession.prototype, "state", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Object)
], WechatShoppingSession.prototype, "draft", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: Date }),
    __metadata("design:type", Date)
], WechatShoppingSession.prototype, "expireAt", void 0);
exports.WechatShoppingSession = WechatShoppingSession = __decorate([
    (0, typeorm_1.Entity)({ name: 'wechat_shopping_session' }),
    (0, typeorm_1.Index)(['openid'], { unique: true }),
    __metadata("design:paramtypes", [Object])
], WechatShoppingSession);
//# sourceMappingURL=wechat-shopping-session.entity.js.map
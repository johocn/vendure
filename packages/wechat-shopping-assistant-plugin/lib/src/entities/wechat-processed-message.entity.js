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
exports.WechatProcessedMessage = void 0;
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
/**
 * 已处理的入站消息（MsgId 幂等去重）。
 * 微信回调 5 秒无应答会重试推送，本表防止同一条消息触发两次搜索/下单。
 * 事件类消息无 MsgId，用 from:createTime:event 组合键。
 */
let WechatProcessedMessage = class WechatProcessedMessage extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.WechatProcessedMessage = WechatProcessedMessage;
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 128 }),
    __metadata("design:type", String)
], WechatProcessedMessage.prototype, "dedupKey", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: Date }),
    __metadata("design:type", Date)
], WechatProcessedMessage.prototype, "receivedAt", void 0);
exports.WechatProcessedMessage = WechatProcessedMessage = __decorate([
    (0, typeorm_1.Entity)({ name: 'wechat_processed_message' }),
    (0, typeorm_1.Index)(['dedupKey'], { unique: true }),
    __metadata("design:paramtypes", [Object])
], WechatProcessedMessage);
//# sourceMappingURL=wechat-processed-message.entity.js.map
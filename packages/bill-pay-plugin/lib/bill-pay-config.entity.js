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
exports.BillPayChannelConfigEntity = void 0;
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
/**
 * 渠道级代买单配置（设计文档 §4）。
 * 说明：设计原稿存 channel.customFields.billPayConfig，但自定义字段会对 channel 表加列，
 * 违反 §15 护栏「迁移只建新表、禁止 ALTER 既有表」，故按纯增量原则落独立表（JSON 文本列）。
 */
let BillPayChannelConfigEntity = class BillPayChannelConfigEntity extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.BillPayChannelConfigEntity = BillPayChannelConfigEntity;
__decorate([
    (0, typeorm_1.Index)({ unique: true }),
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], BillPayChannelConfigEntity.prototype, "channelId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], BillPayChannelConfigEntity.prototype, "config", void 0);
exports.BillPayChannelConfigEntity = BillPayChannelConfigEntity = __decorate([
    (0, typeorm_1.Entity)('bill_pay_config'),
    __metadata("design:paramtypes", [Object])
], BillPayChannelConfigEntity);
//# sourceMappingURL=bill-pay-config.entity.js.map
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
exports.SubscribeMessageLog = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
let SubscribeMessageLog = class SubscribeMessageLog extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.SubscribeMessageLog = SubscribeMessageLog;
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], SubscribeMessageLog.prototype, "customerId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], SubscribeMessageLog.prototype, "openid", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], SubscribeMessageLog.prototype, "templateId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json' }),
    __metadata("design:type", Object)
], SubscribeMessageLog.prototype, "data", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', default: 'pending' }),
    __metadata("design:type", String)
], SubscribeMessageLog.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], SubscribeMessageLog.prototype, "page", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], SubscribeMessageLog.prototype, "miniprogramState", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], SubscribeMessageLog.prototype, "errorMsg", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], SubscribeMessageLog.prototype, "msgId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], SubscribeMessageLog.prototype, "sentAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => core_1.Channel),
    __metadata("design:type", core_1.Channel)
], SubscribeMessageLog.prototype, "channel", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], SubscribeMessageLog.prototype, "channelId", void 0);
__decorate([
    (0, typeorm_1.ManyToMany)(() => core_1.Channel),
    (0, typeorm_1.JoinTable)(),
    __metadata("design:type", Array)
], SubscribeMessageLog.prototype, "channels", void 0);
exports.SubscribeMessageLog = SubscribeMessageLog = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], SubscribeMessageLog);
//# sourceMappingURL=subscribe-message-log.entity.js.map
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
exports.LogisticsTrack = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
let LogisticsTrack = class LogisticsTrack extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.LogisticsTrack = LogisticsTrack;
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], LogisticsTrack.prototype, "fulfillmentId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], LogisticsTrack.prototype, "trackingNo", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], LogisticsTrack.prototype, "carrierCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', default: 'unknown' }),
    __metadata("design:type", String)
], LogisticsTrack.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], LogisticsTrack.prototype, "trackInfo", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], LogisticsTrack.prototype, "signedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], LogisticsTrack.prototype, "lastError", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], LogisticsTrack.prototype, "lastSyncedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => core_1.Channel),
    __metadata("design:type", core_1.Channel)
], LogisticsTrack.prototype, "channel", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], LogisticsTrack.prototype, "channelId", void 0);
__decorate([
    (0, typeorm_1.ManyToMany)(() => core_1.Channel),
    (0, typeorm_1.JoinTable)(),
    __metadata("design:type", Array)
], LogisticsTrack.prototype, "channels", void 0);
exports.LogisticsTrack = LogisticsTrack = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], LogisticsTrack);
//# sourceMappingURL=logistics-track.entity.js.map
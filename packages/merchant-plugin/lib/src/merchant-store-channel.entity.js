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
exports.MerchantStoreChannel = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
/**
 * 门店认领关系：租户渠道 × 门店的可选绑定。
 *
 * 与租户 Channel 解耦的边界就在这里——门店本身不挂渠道，渠道通过本表认领门店；
 * 撤销认领只改状态（REVOKED），不物理删除，便于审计与重新认领。
 */
let MerchantStoreChannel = class MerchantStoreChannel extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.MerchantStoreChannel = MerchantStoreChannel;
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], MerchantStoreChannel.prototype, "storeId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], MerchantStoreChannel.prototype, "channelId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', default: 'OWNER' }),
    __metadata("design:type", String)
], MerchantStoreChannel.prototype, "role", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', default: 'PENDING' }),
    __metadata("design:type", String)
], MerchantStoreChannel.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], MerchantStoreChannel.prototype, "claimedByUserId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'datetime', nullable: true }),
    __metadata("design:type", Object)
], MerchantStoreChannel.prototype, "claimedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'datetime', nullable: true }),
    __metadata("design:type", Object)
], MerchantStoreChannel.prototype, "verifiedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], MerchantStoreChannel.prototype, "contractNo", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], MerchantStoreChannel.prototype, "note", void 0);
exports.MerchantStoreChannel = MerchantStoreChannel = __decorate([
    (0, typeorm_1.Entity)(),
    (0, typeorm_1.Index)(['storeId', 'channelId'], { unique: true }),
    __metadata("design:paramtypes", [Object])
], MerchantStoreChannel);
//# sourceMappingURL=merchant-store-channel.entity.js.map
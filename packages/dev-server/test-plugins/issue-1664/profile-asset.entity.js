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
exports.ProfileAsset = void 0;
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
const profile_entity_1 = require("./profile.entity");
let ProfileAsset = class ProfileAsset extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.ProfileAsset = ProfileAsset;
__decorate([
    (0, typeorm_1.OneToOne)(() => core_1.Asset, { eager: true, onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)(),
    __metadata("design:type", core_1.Asset)
], ProfileAsset.prototype, "asset", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => profile_entity_1.Profile, { onDelete: 'CASCADE' }),
    __metadata("design:type", profile_entity_1.Profile)
], ProfileAsset.prototype, "profile", void 0);
exports.ProfileAsset = ProfileAsset = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], ProfileAsset);
//# sourceMappingURL=profile-asset.entity.js.map
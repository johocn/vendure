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
exports.Profile = void 0;
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
const profile_asset_entity_1 = require("./profile-asset.entity");
let Profile = class Profile extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.Profile = Profile;
__decorate([
    (0, typeorm_1.ManyToOne)(() => core_1.User, user => user.profileId, { onDelete: 'CASCADE' }),
    __metadata("design:type", core_1.User)
], Profile.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Profile.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => profile_asset_entity_1.ProfileAsset, profileAsset => profileAsset.profile, {
        onDelete: 'SET NULL',
        nullable: true,
    }),
    (0, typeorm_1.JoinColumn)(),
    __metadata("design:type", profile_asset_entity_1.ProfileAsset)
], Profile.prototype, "featuredAsset", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => profile_asset_entity_1.ProfileAsset, profileAsset => profileAsset.profile, {
        onDelete: 'CASCADE',
    }),
    __metadata("design:type", Array)
], Profile.prototype, "assets", void 0);
exports.Profile = Profile = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], Profile);
//# sourceMappingURL=profile.entity.js.map
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
exports.ShopGlobalConfig = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
/** 全局配置（L1 底层）：每 app 一条 */
let ShopGlobalConfig = class ShopGlobalConfig extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.ShopGlobalConfig = ShopGlobalConfig;
__decorate([
    (0, typeorm_1.Column)('varchar', { unique: true }),
    __metadata("design:type", String)
], ShopGlobalConfig.prototype, "app", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Object)
], ShopGlobalConfig.prototype, "themeTokens", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Object)
], ShopGlobalConfig.prototype, "defaults", void 0);
exports.ShopGlobalConfig = ShopGlobalConfig = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], ShopGlobalConfig);
//# sourceMappingURL=shop-global-config.entity.js.map
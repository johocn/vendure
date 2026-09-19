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
exports.ShopTemplateVersion = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
let ShopTemplateVersion = class ShopTemplateVersion extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.ShopTemplateVersion = ShopTemplateVersion;
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], ShopTemplateVersion.prototype, "templateId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], ShopTemplateVersion.prototype, "version", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], ShopTemplateVersion.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Object)
], ShopTemplateVersion.prototype, "theme", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Object)
], ShopTemplateVersion.prototype, "pages", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], ShopTemplateVersion.prototype, "enabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], ShopTemplateVersion.prototype, "note", void 0);
exports.ShopTemplateVersion = ShopTemplateVersion = __decorate([
    (0, typeorm_1.Entity)('shop_template_version'),
    __metadata("design:paramtypes", [Object])
], ShopTemplateVersion);
//# sourceMappingURL=shop-template-version.entity.js.map
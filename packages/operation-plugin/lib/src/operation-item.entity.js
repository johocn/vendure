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
exports.OperationItem = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
const operation_section_entity_1 = require("./operation-section.entity");
/**
 * 专区条目。
 * type: banner（图/文案/跳转）/ product（关联 core Product）/ link（纯链接）。
 * sortOrder 条目内排序（升序）。imageAssetId 关联 core Asset，productId 关联 core Product。
 */
let OperationItem = class OperationItem extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.OperationItem = OperationItem;
__decorate([
    (0, typeorm_1.ManyToOne)(() => operation_section_entity_1.OperationSection, section => section.items),
    __metadata("design:type", operation_section_entity_1.OperationSection)
], OperationItem.prototype, "section", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], OperationItem.prototype, "sectionId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], OperationItem.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], OperationItem.prototype, "sortOrder", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], OperationItem.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], OperationItem.prototype, "imageAssetId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], OperationItem.prototype, "linkUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], OperationItem.prototype, "productId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], OperationItem.prototype, "channelId", void 0);
exports.OperationItem = OperationItem = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], OperationItem);
//# sourceMappingURL=operation-item.entity.js.map
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
exports.OperationSection = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
const operation_item_entity_1 = require("./operation-item.entity");
/**
 * 运营位/专区楼层。
 * 一段可后台配置的首页楼层，承载一组 OperationItem 条目（banner/商品/链接）。
 * - code 全局唯一，C 端按 code 精准拉取；type 决定渲染形态（banner/products/link）。
 * - enabled 启停开关：shop-api 只输出 enabled 的专区。
 * - position 楼层排序（越大越靠前）。
 */
let OperationSection = class OperationSection extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.OperationSection = OperationSection;
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', unique: true }),
    __metadata("design:type", String)
], OperationSection.prototype, "code", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], OperationSection.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], OperationSection.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], OperationSection.prototype, "displayMode", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], OperationSection.prototype, "enabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], OperationSection.prototype, "position", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], OperationSection.prototype, "channelId", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => operation_item_entity_1.OperationItem, item => item.section),
    __metadata("design:type", Array)
], OperationSection.prototype, "items", void 0);
__decorate([
    (0, typeorm_1.ManyToMany)(() => core_1.Channel),
    (0, typeorm_1.JoinTable)(),
    __metadata("design:type", Array)
], OperationSection.prototype, "channels", void 0);
exports.OperationSection = OperationSection = __decorate([
    (0, typeorm_1.Entity)(),
    (0, typeorm_1.Index)(['channelId', 'enabled', 'position']),
    __metadata("design:paramtypes", [Object])
], OperationSection);
//# sourceMappingURL=operation-section.entity.js.map
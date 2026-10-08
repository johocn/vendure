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
exports.JianghuEvent = void 0;
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
/**
 * 江湖事件（方向二多人拼图 / 方向三剧本母版）。
 * collected 由运营或脚本更新；参与者均分 rewardPoolRep。
 */
let JianghuEvent = class JianghuEvent extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.JianghuEvent = JianghuEvent;
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], JianghuEvent.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], JianghuEvent.prototype, "desc", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { default: 6 }),
    __metadata("design:type", Number)
], JianghuEvent.prototype, "total", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { default: 0 }),
    __metadata("design:type", Number)
], JianghuEvent.prototype, "collected", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { default: 2 }),
    __metadata("design:type", Number)
], JianghuEvent.prototype, "perPersonLimit", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], JianghuEvent.prototype, "endAt", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { nullable: true }),
    __metadata("design:type", Object)
], JianghuEvent.prototype, "rewardPoolRep", void 0);
exports.JianghuEvent = JianghuEvent = __decorate([
    (0, typeorm_1.Entity)('jianghu_event'),
    __metadata("design:paramtypes", [Object])
], JianghuEvent);
//# sourceMappingURL=jianghu-event.entity.js.map
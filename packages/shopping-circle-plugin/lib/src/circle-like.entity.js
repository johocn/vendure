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
exports.CircleLike = void 0;
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
/** 点赞行（同 postId+customerId 唯一：存在即已赞，删除即取消） */
let CircleLike = class CircleLike extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.CircleLike = CircleLike;
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], CircleLike.prototype, "postId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], CircleLike.prototype, "customerId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], CircleLike.prototype, "channelId", void 0);
exports.CircleLike = CircleLike = __decorate([
    (0, typeorm_1.Entity)(),
    (0, typeorm_1.Unique)(['postId', 'customerId']),
    __metadata("design:paramtypes", [Object])
], CircleLike);
//# sourceMappingURL=circle-like.entity.js.map
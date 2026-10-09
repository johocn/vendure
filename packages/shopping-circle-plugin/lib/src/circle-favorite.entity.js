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
exports.CircleFavorite = void 0;
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
/** 收藏行（与 CircleLike 同构：同 postId+customerId 唯一） */
let CircleFavorite = class CircleFavorite extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.CircleFavorite = CircleFavorite;
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], CircleFavorite.prototype, "postId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], CircleFavorite.prototype, "customerId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], CircleFavorite.prototype, "channelId", void 0);
exports.CircleFavorite = CircleFavorite = __decorate([
    (0, typeorm_1.Entity)(),
    (0, typeorm_1.Unique)(['postId', 'customerId']),
    __metadata("design:paramtypes", [Object])
], CircleFavorite);
//# sourceMappingURL=circle-favorite.entity.js.map
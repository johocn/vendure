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
exports.JianghuClue = exports.ClueStatus = void 0;
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
/** 线索审核状态：PENDING 待审（提交后默认，不上墙不计数）/ SHOWN 已上墙 / REJECTED 已下线 */
exports.ClueStatus = {
    PENDING: 'PENDING',
    SHOWN: 'SHOWN',
    REJECTED: 'REJECTED',
};
/**
 * 江湖事件线索（方向三 P2 多人拼图碎片）。
 * 一条线索由某传信者提交，计入事件 collected（点亮一块拼图）；内容公开可见，
 * 来源必填（合规留痕）。提交后默认为 PENDING，经运营审核通过(SHOWN)才上墙并计入进度，
 * 下线(REJECTED)则回收进度。
 */
let JianghuClue = class JianghuClue extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.JianghuClue = JianghuClue;
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], JianghuClue.prototype, "eventId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], JianghuClue.prototype, "customerId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", String)
], JianghuClue.prototype, "nickname", void 0);
__decorate([
    (0, typeorm_1.Column)('text'),
    __metadata("design:type", String)
], JianghuClue.prototype, "content", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], JianghuClue.prototype, "sourceNote", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", String)
], JianghuClue.prototype, "campusCode", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { default: 0 }),
    __metadata("design:type", Number)
], JianghuClue.prototype, "likes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', default: exports.ClueStatus.PENDING }),
    __metadata("design:type", String)
], JianghuClue.prototype, "status", void 0);
exports.JianghuClue = JianghuClue = __decorate([
    (0, typeorm_1.Entity)('jianghu_clue'),
    __metadata("design:paramtypes", [Object])
], JianghuClue);
//# sourceMappingURL=jianghu-clue.entity.js.map
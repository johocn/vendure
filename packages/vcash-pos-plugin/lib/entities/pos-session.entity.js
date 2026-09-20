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
exports.PosSession = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
const pos_terminal_entity_1 = require("./pos-terminal.entity");
let PosSession = class PosSession {
    constructor() {
        this.approver = null;
        // 简化两态：open / closed
        this.state = 'open';
        this.closedAt = null;
        this.closeSummary = null;
        // 备用金（分）
        this.openingFloat = 0;
        // 实交现金（分）
        this.closingCash = 0;
        // 当前活跃 Draft Order ID
        this.activeOrderId = null;
        /**
         * 当前绑定的会员 ID（可空，未绑定会员时为 null）。
         * POS 收银员通过会员识别 API 绑定，加购时自动应用会员价。
         */
        this.customerId = null;
        this.customer = null;
    }
};
exports.PosSession = PosSession;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], PosSession.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', unique: true }),
    __metadata("design:type", String)
], PosSession.prototype, "code", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.ManyToOne)(() => pos_terminal_entity_1.PosTerminal),
    __metadata("design:type", pos_terminal_entity_1.PosTerminal)
], PosSession.prototype, "terminal", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => core_1.StockLocation),
    __metadata("design:type", core_1.StockLocation)
], PosSession.prototype, "stockLocation", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => core_1.Administrator),
    __metadata("design:type", core_1.Administrator)
], PosSession.prototype, "operator", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => core_1.Administrator, { nullable: true }),
    __metadata("design:type", Object)
], PosSession.prototype, "approver", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', default: 'open' }),
    __metadata("design:type", String)
], PosSession.prototype, "state", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamp' }),
    __metadata("design:type", Date)
], PosSession.prototype, "openedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Object)
], PosSession.prototype, "closedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Object)
], PosSession.prototype, "closeSummary", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], PosSession.prototype, "openingFloat", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], PosSession.prototype, "closingCash", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], PosSession.prototype, "activeOrderId", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], PosSession.prototype, "customerId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => core_1.Customer, { nullable: true }),
    __metadata("design:type", Object)
], PosSession.prototype, "customer", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: 'timestamp' }),
    __metadata("design:type", Date)
], PosSession.prototype, "updatedAt", void 0);
exports.PosSession = PosSession = __decorate([
    (0, typeorm_1.Entity)()
], PosSession);
//# sourceMappingURL=pos-session.entity.js.map
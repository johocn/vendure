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
exports.StorageZone = void 0;
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
let StorageZone = class StorageZone extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.StorageZone = StorageZone;
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], StorageZone.prototype, "tenantChannelId", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ type: 'integer' }),
    __metadata("design:type", Number)
], StorageZone.prototype, "stockLocationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], StorageZone.prototype, "code", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], StorageZone.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], StorageZone.prototype, "sortOrder", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], StorageZone.prototype, "enabled", void 0);
exports.StorageZone = StorageZone = __decorate([
    (0, typeorm_1.Entity)('storage_zone'),
    (0, typeorm_1.Unique)(['tenantChannelId', 'stockLocationId', 'code']),
    __metadata("design:paramtypes", [Object])
], StorageZone);
//# sourceMappingURL=storage-zone.entity.js.map
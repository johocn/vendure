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
exports.LiveRoomPlatform = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
const live_room_entity_1 = require("./live-room.entity");
let LiveRoomPlatform = class LiveRoomPlatform extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.LiveRoomPlatform = LiveRoomPlatform;
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.ManyToOne)(() => live_room_entity_1.LiveRoom, room => room.platforms, { onDelete: 'CASCADE' }),
    __metadata("design:type", live_room_entity_1.LiveRoom)
], LiveRoomPlatform.prototype, "liveRoom", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 32 }),
    __metadata("design:type", String)
], LiveRoomPlatform.prototype, "platform", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 512 }),
    __metadata("design:type", String)
], LiveRoomPlatform.prototype, "externalUrl", void 0);
__decorate([
    (0, typeorm_1.ManyToMany)(() => core_1.Channel),
    (0, typeorm_1.JoinTable)(),
    __metadata("design:type", Array)
], LiveRoomPlatform.prototype, "channels", void 0);
exports.LiveRoomPlatform = LiveRoomPlatform = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], LiveRoomPlatform);

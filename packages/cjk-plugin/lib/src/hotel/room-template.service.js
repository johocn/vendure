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
exports.RoomTemplateService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const room_template_entity_1 = require("./room-template.entity");
const hotel_config_1 = require("./hotel-config");
let RoomTemplateService = class RoomTemplateService {
    constructor(connection) {
        this.connection = connection;
    }
    findAll() {
        return this.connection
            .getRepository(room_template_entity_1.RoomTemplate)
            .find({ order: { sortOrder: 'ASC', createdAt: 'DESC' } });
    }
    async findOne(id) {
        const result = await this.connection.getRepository(room_template_entity_1.RoomTemplate).findOne({ where: { id } });
        return result !== null && result !== void 0 ? result : undefined;
    }
    async create(input) {
        var _a, _b, _c;
        const check = (0, hotel_config_1.validateHotelConfig)({
            basePriceCent: input.basePriceCent,
            priceCalendar: (_a = input.priceCalendar) !== null && _a !== void 0 ? _a : undefined,
            specs: (_b = input.specs) !== null && _b !== void 0 ? _b : undefined,
        });
        if (!check.valid) {
            throw new Error(`RoomTemplate 校验失败: ${check.errors.join('; ')}`);
        }
        const repo = this.connection.getRepository(room_template_entity_1.RoomTemplate);
        const entity = new room_template_entity_1.RoomTemplate(Object.assign(Object.assign({}, input), { name: typeof input.name === 'string' ? input.name : JSON.stringify((_c = input.name) !== null && _c !== void 0 ? _c : '') }));
        return repo.save(entity);
    }
    async update(id, input) {
        var _a, _b;
        const check = (0, hotel_config_1.validateHotelConfig)({
            basePriceCent: input.basePriceCent,
            priceCalendar: (_a = input.priceCalendar) !== null && _a !== void 0 ? _a : undefined,
            specs: (_b = input.specs) !== null && _b !== void 0 ? _b : undefined,
        });
        if (!check.valid) {
            throw new Error(`RoomTemplate 校验失败: ${check.errors.join('; ')}`);
        }
        const repo = this.connection.getRepository(room_template_entity_1.RoomTemplate);
        const entity = await repo.findOneOrFail({ where: { id } });
        Object.assign(entity, input);
        if (input.name && typeof input.name !== 'string') {
            entity.name = JSON.stringify(input.name);
        }
        return repo.save(entity);
    }
    async delete(id) {
        const repo = this.connection.getRepository(room_template_entity_1.RoomTemplate);
        const entity = await repo.findOneOrFail({ where: { id } });
        await repo.remove(entity);
    }
    /**
     * 套用模板 → 深拷贝快照进变体 customFields hotelRoomConfig。
     * 之后模板修改不影响本变体；变体侧可再编辑快照。
     */
    async applyToVariant(ctx, variantId, templateId) {
        var _a, _b, _c, _d, _e;
        const template = await this.connection
            .getRepository(ctx, room_template_entity_1.RoomTemplate)
            .findOne({ where: { id: templateId } });
        if (!template)
            throw new Error(`RoomTemplate ${templateId} 不存在`);
        const snapshot = {
            templateCode: template.code,
            specs: (_a = template.specs) !== null && _a !== void 0 ? _a : undefined,
            rooms: ((_b = template.defaultRooms) !== null && _b !== void 0 ? _b : []).map(r => (Object.assign({}, r))),
            basePriceCent: template.basePriceCent,
            priceCalendar: ((_c = template.priceCalendar) !== null && _c !== void 0 ? _c : []).map(s => (Object.assign(Object.assign({}, s), { dates: s.dates ? [...s.dates] : undefined }))),
            longStayDiscount: ((_d = template.longStayDiscount) !== null && _d !== void 0 ? _d : []).map(d => (Object.assign({}, d))),
            minNights: template.minNights,
            maxNights: template.maxNights,
            advanceDays: template.advanceDays,
            checkInTime: template.checkInTime,
            checkOutTime: template.checkOutTime,
            cancelPolicy: Object.assign({}, template.cancelPolicy),
            depositType: template.depositType,
        };
        const vRepo = this.connection.getRepository(ctx, core_1.ProductVariant);
        const v = await vRepo.findOne({ where: { id: variantId } });
        if (!v)
            throw new Error(`ProductVariant ${variantId} 不存在`);
        // hotelRoomConfig 为 text 类型（Vendure 3.6 无 json 自定义字段类型），存 JSON 字符串，读取端 JSON.parse
        v.customFields = Object.assign(Object.assign({}, ((_e = v.customFields) !== null && _e !== void 0 ? _e : {})), { hotelRoomConfig: JSON.stringify(snapshot) });
        await vRepo.save(v);
        return true;
    }
};
exports.RoomTemplateService = RoomTemplateService;
exports.RoomTemplateService = RoomTemplateService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], RoomTemplateService);
//# sourceMappingURL=room-template.service.js.map
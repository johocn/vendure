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
exports.OperationService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
const operation_item_entity_1 = require("./operation-item.entity");
const operation_section_entity_1 = require("./operation-section.entity");
let OperationService = class OperationService {
    constructor(connection) {
        this.connection = connection;
    }
    // ---------- Admin ----------
    /** 全量专区（含 items，按 position 降序）。 */
    async listSections(ctx) {
        const sections = await this.connection.getRepository(ctx, operation_section_entity_1.OperationSection).find({
            where: { channelId: ctx.channelId },
            relations: { items: true },
            order: { position: 'DESC' },
        });
        this.sortItems(sections);
        return sections;
    }
    async getByCode(ctx, code) {
        const section = await this.connection.getRepository(ctx, operation_section_entity_1.OperationSection).findOne({
            where: { code, channelId: ctx.channelId },
            relations: { items: true },
        });
        if (!section) {
            throw new core_1.EntityNotFoundError('OperationSection', code);
        }
        this.sortItems([section]);
        return section;
    }
    async createSection(ctx, input) {
        var _a, _b, _c;
        if (!input.code || !input.name || !input.type) {
            throw new Error('OperationSection 缺少必填字段 code/name/type');
        }
        const section = new operation_section_entity_1.OperationSection({
            code: input.code,
            name: input.name,
            type: input.type,
            displayMode: (_a = input.displayMode) !== null && _a !== void 0 ? _a : null,
            enabled: (_b = input.enabled) !== null && _b !== void 0 ? _b : true,
            position: (_c = input.position) !== null && _c !== void 0 ? _c : 0,
            channelId: ctx.channelId,
        });
        await this.connection.getRepository(ctx, operation_section_entity_1.OperationSection).save(section);
        return this.getByCode(ctx, section.code);
    }
    async updateSection(ctx, id, input) {
        const section = await this.requireSection(ctx, id);
        if (input.name !== undefined)
            section.name = input.name;
        if (input.type !== undefined)
            section.type = input.type;
        if (input.displayMode !== undefined)
            section.displayMode = input.displayMode;
        if (input.enabled !== undefined)
            section.enabled = input.enabled;
        if (input.position !== undefined)
            section.position = input.position;
        await this.connection.getRepository(ctx, operation_section_entity_1.OperationSection).save(section);
        return this.getByCode(ctx, section.code);
    }
    async deleteSection(ctx, id) {
        const section = await this.requireSection(ctx, id);
        // 先删条目，避免 FK 约束（ManyToOne sectionId）
        await this.connection
            .getRepository(ctx, operation_item_entity_1.OperationItem)
            .remove(await this.connection.getRepository(ctx, operation_item_entity_1.OperationItem).find({
            where: { sectionId: Number(id) },
        }));
        await this.connection.getRepository(ctx, operation_section_entity_1.OperationSection).remove(section);
        return true;
    }
    /** 整段替换条目：删除该专区旧条目后按输入全量重建（幂等，按 sortOrder 有序）。 */
    async setOperationItems(ctx, sectionId, items) {
        var _a, _b, _c;
        const section = await this.requireSection(ctx, sectionId);
        const repo = this.connection.getRepository(ctx, operation_item_entity_1.OperationItem);
        const old = await repo.find({ where: { sectionId: Number(sectionId) } });
        if (old.length > 0) {
            await repo.remove(old);
        }
        const saved = [];
        for (const it of items) {
            const item = new operation_item_entity_1.OperationItem({
                section,
                sectionId: Number(sectionId),
                type: it.type,
                sortOrder: (_a = it.sortOrder) !== null && _a !== void 0 ? _a : 0,
                title: (_b = it.title) !== null && _b !== void 0 ? _b : null,
                imageAssetId: it.imageAssetId != null ? Number(it.imageAssetId) : null,
                linkUrl: (_c = it.linkUrl) !== null && _c !== void 0 ? _c : null,
                productId: it.productId != null ? Number(it.productId) : null,
                channelId: ctx.channelId,
            });
            saved.push(await repo.save(item));
        }
        return saved.sort((a, b) => a.sortOrder - b.sortOrder);
    }
    /** 校验专区存在（按 id + channel 过滤）。 */
    async requireSection(ctx, id) {
        const section = await this.connection.getRepository(ctx, operation_section_entity_1.OperationSection).findOne({
            where: { id: Number(id), channelId: ctx.channelId },
            relations: { items: true },
        });
        if (!section) {
            throw new core_1.EntityNotFoundError('OperationSection', id);
        }
        return section;
    }
    // ---------- Shop ----------
    /** 仅已启用专区，按 position 降序；items 按 sortOrder 升序。 */
    async listEnabled(ctx) {
        const sections = await this.connection.getRepository(ctx, operation_section_entity_1.OperationSection).find({
            where: { channelId: ctx.channelId, enabled: true },
            relations: { items: true },
            order: { position: 'DESC' },
        });
        this.sortItems(sections);
        return sections;
    }
    /** 按 code 取单个已启用专区；未启用返回 null。 */
    async getEnabledByCode(ctx, code) {
        const section = await this.connection.getRepository(ctx, operation_section_entity_1.OperationSection).findOne({
            where: { code, channelId: ctx.channelId, enabled: true },
            relations: { items: true },
        });
        if (!section) {
            return null;
        }
        this.sortItems([section]);
        return section;
    }
    /** 批量解析条目目标（product / imageUrl），一次查询防 N+1；结果挂在条目实体上供 ResolveField 读取。 */
    async resolveTargets(ctx, sections) {
        var _a, _b;
        const items = [];
        for (const s of sections) {
            for (const it of (_a = s.items) !== null && _a !== void 0 ? _a : []) {
                items.push(it);
            }
        }
        if (items.length === 0) {
            return;
        }
        const productIds = [...new Set(items.filter(i => i.productId != null).map(i => Number(i.productId)))];
        if (productIds.length > 0) {
            const products = await this.connection.getRepository(ctx, core_1.Product).find({
                where: { id: (0, typeorm_1.In)(productIds) },
            });
            const map = new Map(products.map(p => [p.id, p]));
            for (const it of items) {
                if (it.productId != null) {
                    it.__product = (_b = map.get(Number(it.productId))) !== null && _b !== void 0 ? _b : null;
                }
            }
        }
        const assetIds = [...new Set(items.filter(i => i.imageAssetId != null).map(i => Number(i.imageAssetId)))];
        if (assetIds.length > 0) {
            const assets = await this.connection.getRepository(ctx, core_1.Asset).find({
                where: { id: (0, typeorm_1.In)(assetIds) },
            });
            const map = new Map(assets.map(a => [a.id, a]));
            for (const it of items) {
                if (it.imageAssetId != null) {
                    const asset = map.get(Number(it.imageAssetId));
                    it.__imageUrl = asset ? asset.preview : null;
                }
            }
        }
    }
    sortItems(sections) {
        var _a;
        for (const s of sections) {
            s.items = ((_a = s.items) !== null && _a !== void 0 ? _a : []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
        }
    }
};
exports.OperationService = OperationService;
exports.OperationService = OperationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], OperationService);
//# sourceMappingURL=operation.service.js.map
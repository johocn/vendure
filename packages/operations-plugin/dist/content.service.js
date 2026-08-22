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
exports.ContentService = void 0;
// e:\code\vendure\packages\operations-plugin\src\content.service.ts
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
const constants_1 = require("./constants");
const content_item_entity_1 = require("./entities/content-item.entity");
let ContentService = class ContentService {
    constructor(connection) {
        this.connection = connection;
    }
    // ===== CRUD =====
    async createContentItem(ctx, input) {
        var _a, _b;
        // Validate type
        const type = this.validateType(input.type);
        // Validate data structure
        this.validateDataByType(type, input.data);
        // Validate code uniqueness (among non-deleted)
        const existing = await this.connection
            .getRepository(ctx, content_item_entity_1.ContentItem)
            .findOne({ where: { code: input.code, deletedAt: (0, typeorm_1.IsNull)() } });
        if (existing) {
            throw new core_1.UserInputError(`Content item code '${input.code}' already exists in this channel`);
        }
        const item = new content_item_entity_1.ContentItem({
            type,
            code: input.code,
            name: input.name,
            enabled: true,
            sort: (_a = input.sort) !== null && _a !== void 0 ? _a : 0,
            position: (_b = input.position) !== null && _b !== void 0 ? _b : 'home',
            startAt: input.startAt,
            endAt: input.endAt,
            data: input.data,
            staffId: ctx.activeUserId ? String(ctx.activeUserId) : undefined,
        });
        return this.connection.getRepository(ctx, content_item_entity_1.ContentItem).save(item);
    }
    async updateContentItem(ctx, id, input) {
        const item = await this.findOneContentItem(ctx, id);
        if (!item) {
            throw new core_1.UserInputError('Content item not found');
        }
        if (input.name !== undefined)
            item.name = input.name;
        if (input.enabled !== undefined)
            item.enabled = input.enabled;
        if (input.sort !== undefined)
            item.sort = input.sort;
        if (input.position !== undefined)
            item.position = input.position;
        if (input.startAt !== undefined)
            item.startAt = input.startAt;
        if (input.endAt !== undefined)
            item.endAt = input.endAt;
        if (input.data !== undefined) {
            this.validateDataByType(item.type, input.data);
            item.data = input.data;
        }
        return this.connection.getRepository(ctx, content_item_entity_1.ContentItem).save(item);
    }
    async deleteContentItem(ctx, id) {
        const item = await this.findOneContentItem(ctx, id);
        if (!item) {
            throw new core_1.UserInputError('Content item not found');
        }
        item.deletedAt = new Date();
        item.deletedBy = ctx.activeUserId ? String(ctx.activeUserId) : undefined;
        await this.connection.getRepository(ctx, content_item_entity_1.ContentItem).save(item);
        return true;
    }
    async findContentItems(ctx, options) {
        var _a, _b;
        const qb = this.connection
            .getRepository(ctx, content_item_entity_1.ContentItem)
            .createQueryBuilder('content')
            .where('content.deletedAt IS NULL');
        if (options.type) {
            qb.andWhere('content.type = :type', { type: options.type });
        }
        if (options.position) {
            qb.andWhere('content.position = :position', { position: options.position });
        }
        if (options.enabled !== undefined) {
            qb.andWhere('content.enabled = :enabled', { enabled: options.enabled });
        }
        qb.orderBy('content.sort', 'ASC').addOrderBy('content.createdAt', 'DESC');
        const page = (_a = options.page) !== null && _a !== void 0 ? _a : 1;
        const pageSize = (_b = options.pageSize) !== null && _b !== void 0 ? _b : 20;
        qb.skip((page - 1) * pageSize).take(pageSize);
        const [items, totalItems] = await qb.getManyAndCount();
        return { items, totalItems };
    }
    async findOneContentItem(ctx, id) {
        return this.connection
            .getRepository(ctx, content_item_entity_1.ContentItem)
            .findOne({ where: { id: id, deletedAt: (0, typeorm_1.IsNull)() } });
    }
    // ===== shop-api public query (only published content) =====
    async findPublishedContentItems(ctx, options) {
        const qb = this.connection
            .getRepository(ctx, content_item_entity_1.ContentItem)
            .createQueryBuilder('content')
            .where('content.deletedAt IS NULL')
            .andWhere('content.enabled = :enabled', { enabled: true })
            .andWhere('content.publishedAt IS NOT NULL');
        if (options.type) {
            qb.andWhere('content.type = :type', { type: options.type });
        }
        if (options.position) {
            qb.andWhere('content.position = :position', { position: options.position });
        }
        const now = new Date();
        qb.andWhere('(content.startAt IS NULL OR content.startAt <= :now)', { now });
        qb.andWhere('(content.endAt IS NULL OR content.endAt > :now)', { now });
        qb.orderBy('content.sort', 'ASC');
        return qb.getMany();
    }
    // ===== Validation =====
    validateType(type) {
        const validTypes = Object.values(constants_1.ContentType);
        if (!validTypes.includes(type)) {
            throw new core_1.UserInputError(`Invalid content type: ${type}. Must be one of ${validTypes.join(', ')}`);
        }
        return type;
    }
    validateDataByType(type, data) {
        if (!data) {
            throw new core_1.UserInputError(`Invalid data for type '${type}': data is required`);
        }
        switch (type) {
            case constants_1.ContentType.Banner:
                if (!data.imageUrl) {
                    throw new core_1.UserInputError(`Invalid data for type '${type}': missing required field 'imageUrl'`);
                }
                break;
            case constants_1.ContentType.Recommendation:
                if (!data.itemType) {
                    throw new core_1.UserInputError(`Invalid data for type '${type}': missing required field 'itemType'`);
                }
                if (!data.itemId) {
                    throw new core_1.UserInputError(`Invalid data for type '${type}': missing required field 'itemId'`);
                }
                break;
            case constants_1.ContentType.Notice:
                if (!data.content) {
                    throw new core_1.UserInputError(`Invalid data for type '${type}': missing required field 'content'`);
                }
                break;
            case constants_1.ContentType.Floor:
                if (!data.title) {
                    throw new core_1.UserInputError(`Invalid data for type '${type}': missing required field 'title'`);
                }
                if (!data.layout) {
                    throw new core_1.UserInputError(`Invalid data for type '${type}': missing required field 'layout'`);
                }
                if (!Array.isArray(data.items)) {
                    throw new core_1.UserInputError(`Invalid data for type '${type}': missing required field 'items' (array)`);
                }
                break;
            case constants_1.ContentType.IconGrid:
                if (!Array.isArray(data.items) || data.items.length === 0) {
                    throw new core_1.UserInputError(`Invalid data for type '${type}': missing required field 'items' (array of {icon,label,link})`);
                }
                break;
            case constants_1.ContentType.CategoryNav:
                if (!Array.isArray(data.items) || data.items.length === 0) {
                    throw new core_1.UserInputError(`Invalid data for type '${type}': missing required field 'items' (array of {name,slug|collection})`);
                }
                break;
        }
    }
    // ===== Auto online/offline (called by ScheduledTask) =====
    async runLifecycleCheck(ctx) {
        const repo = this.connection.getRepository(ctx, content_item_entity_1.ContentItem);
        const now = new Date();
        let published = 0;
        let unpublished = 0;
        // Publish: enabled=true AND startAt <= now AND publishedAt IS NULL AND deletedAt IS NULL
        const toPublish = await repo
            .createQueryBuilder('content')
            .where('content.deletedAt IS NULL')
            .andWhere('content.enabled = :enabled', { enabled: true })
            .andWhere('content.startAt IS NOT NULL')
            .andWhere('content.startAt <= :now', { now })
            .andWhere('content.publishedAt IS NULL')
            .getMany();
        for (const item of toPublish) {
            try {
                item.publishedAt = now;
                await repo.save(item);
                published++;
            }
            catch (e) {
                core_1.Logger.error(`Failed to publish content ${item.id}: ${e.message}`, 'OperationsContentService');
            }
        }
        // Unpublish: enabled=true AND endAt <= now AND unpublishedAt IS NULL AND deletedAt IS NULL
        const toUnpublish = await repo
            .createQueryBuilder('content')
            .where('content.deletedAt IS NULL')
            .andWhere('content.enabled = :enabled', { enabled: true })
            .andWhere('content.endAt IS NOT NULL')
            .andWhere('content.endAt <= :now', { now })
            .andWhere('content.unpublishedAt IS NULL')
            .getMany();
        for (const item of toUnpublish) {
            try {
                item.enabled = false;
                item.unpublishedAt = now;
                await repo.save(item);
                unpublished++;
            }
            catch (e) {
                core_1.Logger.error(`Failed to unpublish content ${item.id}: ${e.message}`, 'OperationsContentService');
            }
        }
        return { published, unpublished };
    }
};
exports.ContentService = ContentService;
exports.ContentService = ContentService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], ContentService);

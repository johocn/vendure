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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FillBufferPlugin = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const graphql_tag_1 = __importDefault(require("graphql-tag"));
let FillBufferResolver = class FillBufferResolver {
    constructor(productVariantService, collectionService) {
        this.productVariantService = productVariantService;
        this.collectionService = collectionService;
    }
    async fillBuffer(ctx) {
        const { items: variants } = await this.productVariantService.findAll(ctx);
        const { items: collections } = await this.collectionService.findAll(ctx);
        const limit = 2000;
        for (let i = 0; i < limit; i++) {
            const variant = variants[i % variants.length];
            await this.productVariantService.update(ctx, [
                {
                    id: variant.id,
                    enabled: !variant.enabled,
                },
            ]);
            const collection = collections[i % collections.length];
            await this.collectionService.update(ctx, {
                id: collection.id,
                isPrivate: !collection.isPrivate,
            });
            if (i % 100 === 0) {
                core_1.Logger.info(`Updated ${i} / ${limit} items...`);
            }
        }
        core_1.Logger.info(`Done!`);
        return true;
    }
};
__decorate([
    (0, graphql_1.Mutation)(),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], FillBufferResolver.prototype, "fillBuffer", null);
FillBufferResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [core_1.ProductVariantService,
        core_1.CollectionService])
], FillBufferResolver);
/**
 * Plugin to create a lot of buffered jobs to test help investigate and fix
 * issue https://github.com/vendurehq/vendure/issues/1433
 */
let FillBufferPlugin = class FillBufferPlugin {
};
exports.FillBufferPlugin = FillBufferPlugin;
exports.FillBufferPlugin = FillBufferPlugin = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        adminApiExtensions: {
            schema: (0, graphql_tag_1.default) `
            extend type Mutation {
                fillBuffer: Boolean!
            }
        `,
            resolvers: [FillBufferResolver],
        },
    })
], FillBufferPlugin);
//# sourceMappingURL=fill-buffer-plugin.js.map
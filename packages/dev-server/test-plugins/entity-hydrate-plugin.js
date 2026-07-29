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
exports.EntityHydratePlugin = void 0;
/* eslint-disable @typescript-eslint/no-non-null-assertion */
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const graphql_tag_1 = __importDefault(require("graphql-tag"));
let TestResolver = class TestResolver {
    constructor(productVariantService, connection, entityHydrator) {
        this.productVariantService = productVariantService;
        this.connection = connection;
        this.entityHydrator = entityHydrator;
    }
    async hydrateTest(ctx, args) {
        const product = await this.connection.getRepository(ctx, core_1.Product).findOne({
            where: { id: args.id },
            relations: ['featuredAsset'],
        });
        await this.entityHydrator.hydrate(ctx, product, {
            relations: ['facetValues.facet', 'customFields.thumb'],
        });
        return product;
    }
};
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], TestResolver.prototype, "hydrateTest", null);
TestResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [core_1.ProductVariantService,
        core_1.TransactionalConnection,
        core_1.EntityHydrator])
], TestResolver);
// A plugin to explore solutions to https://github.com/vendurehq/vendure/issues/1103
let EntityHydratePlugin = class EntityHydratePlugin {
};
exports.EntityHydratePlugin = EntityHydratePlugin;
exports.EntityHydratePlugin = EntityHydratePlugin = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        adminApiExtensions: {
            schema: (0, graphql_tag_1.default) `
            extend type Query {
                hydrateTest(id: ID!): JSON
            }
        `,
            resolvers: [TestResolver],
        },
        configuration: config => {
            config.customFields.Product.push({
                name: 'thumb',
                type: 'relation',
                entity: core_1.Asset,
            });
            return config;
        },
    })
], EntityHydratePlugin);
//# sourceMappingURL=entity-hydrate-plugin.js.map
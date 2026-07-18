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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TypeormIssuePlugin = exports.TestResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const graphql_tag_1 = require("graphql-tag");
// Testing this issue https://github.com/typeorm/typeorm/issues/7707
let TestResolver = class TestResolver {
    constructor(connection, listQueryBuilder) {
        this.connection = connection;
        this.listQueryBuilder = listQueryBuilder;
    }
    test(ctx, args) {
        const relations = [
            'options',
            'facetValues',
            'facetValues.facet',
            'taxCategory',
            'assets',
            'featuredAsset',
        ];
        return this.listQueryBuilder
            .build(core_1.ProductVariant, {}, {
            relations,
            orderBy: { id: 'ASC' },
            where: { deletedAt: null },
            ctx,
        })
            .innerJoinAndSelect('productvariant.channels', 'channel', 'channel.id = :channelId', {
            channelId: ctx.channelId,
        })
            .innerJoinAndSelect('productvariant.product', 'product', 'product.id = :productId', {
            id: args.id,
        })
            .getManyAndCount()
            .then(async ([variants, totalItems]) => {
            const items = await Promise.all(variants.map(async (variant) => {
                return (0, core_1.translateDeep)(variant, ctx.languageCode, [
                    'options',
                    'facetValues',
                    ['facetValues', 'facet'],
                ]);
            }));
            return {
                items,
                totalItems,
            };
        });
    }
};
exports.TestResolver = TestResolver;
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", void 0)
], TestResolver.prototype, "test", null);
exports.TestResolver = TestResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection, core_1.ListQueryBuilder])
], TestResolver);
let TypeormIssuePlugin = class TypeormIssuePlugin {
};
exports.TypeormIssuePlugin = TypeormIssuePlugin;
exports.TypeormIssuePlugin = TypeormIssuePlugin = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        shopApiExtensions: {
            schema: (0, graphql_tag_1.gql) `
            extend type Query {
                test(id: ID!): [ProductVariant!]!
            }
        `,
            resolvers: [TestResolver],
        },
    })
], TypeormIssuePlugin);
//# sourceMappingURL=typeorm-issue-plugin.js.map
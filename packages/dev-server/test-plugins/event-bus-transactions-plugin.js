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
exports.EventBusTransactionsPlugin = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const graphql_tag_1 = __importDefault(require("graphql-tag"));
let TestResolver = class TestResolver {
    constructor(assetService) {
        this.assetService = assetService;
    }
    async setAssetName(ctx, args) {
        await this.assetService.update(ctx, {
            id: args.id,
            name: args.name,
        });
        await new Promise(resolve => setTimeout(resolve, 500));
        core_1.Logger.info('setAssetName returning');
        return true;
    }
};
__decorate([
    (0, core_1.Transaction)(),
    (0, graphql_1.Mutation)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], TestResolver.prototype, "setAssetName", null);
TestResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [core_1.AssetService])
], TestResolver);
// A plugin to explore solutions to https://github.com/vendurehq/vendure/issues/1107
let EventBusTransactionsPlugin = class EventBusTransactionsPlugin {
    constructor(eventBus, connection) {
        this.eventBus = eventBus;
        this.connection = connection;
    }
    onModuleInit() {
        this.eventBus.ofType(core_1.AssetEvent).subscribe(async (event) => {
            core_1.Logger.info('Event handler started');
            const repository = this.connection.getRepository(event.ctx, core_1.Asset);
            await new Promise(resolve => setTimeout(resolve, 1000));
            const asset = await repository.findOne(event.asset.id);
            core_1.Logger.info(`The asset name is ${asset === null || asset === void 0 ? void 0 : asset.name}`);
            asset.name = asset.name + ' modified';
            await repository.save(asset);
        });
    }
};
exports.EventBusTransactionsPlugin = EventBusTransactionsPlugin;
exports.EventBusTransactionsPlugin = EventBusTransactionsPlugin = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        adminApiExtensions: {
            schema: (0, graphql_tag_1.default) `
            extend type Mutation {
                setAssetName(id: ID!, name: String!): Boolean
            }
        `,
            resolvers: [TestResolver],
        },
    }),
    __metadata("design:paramtypes", [core_1.EventBus,
        core_1.TransactionalConnection])
], EventBusTransactionsPlugin);
//# sourceMappingURL=event-bus-transactions-plugin.js.map
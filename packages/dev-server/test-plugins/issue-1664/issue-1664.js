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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Test1664Plugin = void 0;
const shared_constants_1 = require("@vendure/common/lib/shared-constants");
const core_1 = require("@vendure/core");
const graphql_tag_1 = __importDefault(require("graphql-tag"));
const profile_asset_entity_1 = require("./profile-asset.entity");
const profile_entity_1 = require("./profile.entity");
const schema = (0, graphql_tag_1.default) `
    type Profile implements Node {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        name: String!
        user: User!
    }
`;
/**
 * Test plugin for https://github.com/vendurehq/vendure/issues/1664
 *
 * Test query:
 * ```graphql
 * query {
 *   product(id: 1) {
 *     name
 *     customFields {
 *       owner {
 *         id
 *         identifier
 *         customFields {
 *           profile {
 *             id
 *             name
 *           }
 *         }
 *       }
 *     }
 *   }
 * }
 * ```
 */
let Test1664Plugin = class Test1664Plugin {
    constructor(connection, orderService) {
        this.connection = connection;
        this.orderService = orderService;
    }
    async onApplicationBootstrap() {
        await this.createDummyProfiles();
        await this.createDummyOrder();
    }
    async createDummyProfiles() {
        const profilesCount = await this.connection.rawConnection.getRepository(profile_entity_1.Profile).count();
        if (0 < profilesCount) {
            return;
        }
        // Create a Profile and assign it to all the products
        const users = await this.connection.rawConnection.getRepository(core_1.User).find();
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const user = users[1];
        const profile = await this.connection.rawConnection.getRepository(profile_entity_1.Profile).save(new profile_entity_1.Profile({
            name: 'Test Profile',
            user,
        }));
        user.customFields.profile = profile;
        await this.connection.rawConnection.getRepository(core_1.User).save(user);
        const asset = await this.connection.rawConnection.getRepository(core_1.Asset).findOne({ where: { id: 1 } });
        if (asset) {
            const profileAsset = this.connection.rawConnection.getRepository(profile_asset_entity_1.ProfileAsset).save({
                asset,
                profile,
            });
        }
        const products = await this.connection.rawConnection.getRepository(core_1.Product).find();
        for (const product of products) {
            product.customFields.owner = user;
            await this.connection.rawConnection.getRepository(core_1.Product).save(product);
        }
    }
    async createDummyOrder() {
        const orderCount = await this.connection.rawConnection.getRepository(core_1.Order).count();
        if (0 < orderCount) {
            return;
        }
        const defaultChannel = await this.connection.getRepository(core_1.Channel).findOne({
            relations: ['defaultShippingZone', 'defaultTaxZone'],
            where: {
                code: shared_constants_1.DEFAULT_CHANNEL_CODE,
            },
        });
        if (!defaultChannel) {
            throw new Error(`Channel with code ${shared_constants_1.DEFAULT_CHANNEL_CODE} could not be found.`);
        }
        const ctx = new core_1.RequestContext({
            apiType: 'shop',
            authorizedAsOwnerOnly: false,
            channel: defaultChannel,
            isAuthorized: true,
            languageCode: defaultChannel.defaultLanguageCode,
        });
        // Create order
        const users = await this.connection.rawConnection.getRepository(core_1.User).find();
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const customer = users[1];
        const created = await this.orderService.create(ctx, customer.id);
        // Add products
        const products = await this.connection.rawConnection
            .getRepository(core_1.Product)
            .find({ relations: ['variants'] });
        const product = products[0];
        await this.orderService.addItemToOrder(ctx, created.id, product.variants[0].id, 1);
        // Add the product owner to order
        const productOwner = product.customFields.owner;
        await this.orderService.updateCustomFields(ctx, created.id, { productOwner });
    }
};
exports.Test1664Plugin = Test1664Plugin;
exports.Test1664Plugin = Test1664Plugin = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        entities: () => [profile_entity_1.Profile, profile_asset_entity_1.ProfileAsset],
        shopApiExtensions: { schema, resolvers: [] },
        adminApiExtensions: { schema, resolvers: [] },
        configuration: config => {
            // Order
            config.customFields.Order.push({
                name: 'productOwner', // because orders are always c2c (and should be stored redundant in case product get's deleted)
                nullable: true,
                type: 'relation',
                entity: core_1.User,
                public: false,
                eager: true,
                readonly: true,
            });
            config.customFields.Product.push({
                name: 'owner',
                nullable: true,
                type: 'relation',
                entity: core_1.User,
                public: false,
                eager: true, // needs to be eager to enable indexing of user->profile attributes like name, etc.
                readonly: true,
            });
            // User
            config.customFields.User.push({
                name: 'profile',
                type: 'relation',
                entity: profile_entity_1.Profile,
                nullable: true,
                public: false,
                internal: false,
                readonly: true,
                eager: true, // needs to be eager to enable indexing of profile attributes like name, etc.
            });
            return config;
        },
    }),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.OrderService])
], Test1664Plugin);
//# sourceMappingURL=issue-1664.js.map
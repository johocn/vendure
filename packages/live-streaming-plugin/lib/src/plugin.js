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
var LiveStreamingPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiveStreamingPlugin = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const core_2 = require("@vendure/core");
const graphql_tag_1 = __importDefault(require("graphql-tag"));
const constants_1 = require("./constants");
const live_room_entity_1 = require("./live-room.entity");
const live_room_product_entity_1 = require("./live-room-product.entity");
const live_admin_resolver_1 = require("./live-admin.resolver");
const live_shop_resolver_1 = require("./live-shop.resolver");
const live_room_service_1 = require("./live-room.service");
const live_commission_service_1 = require("./live-commission.service");
const liveRoomType = `
type LiveRoom implements Node {
    id: ID!
    name: String!
    coverUrl: String
    description: String
    streamerCustomerId: ID
    streamerName: String
    type: String!
    status: String!
    scheduledStartAt: DateTime
    startedAt: DateTime
    endedAt: DateTime
    playUrl: String
    replayUrl: String
    likeCount: Int!
    viewCount: Int!
    pushUrl: String
    products: [LiveRoomProduct!]!
    createdAt: DateTime!
    updatedAt: DateTime!
}

type LiveRoomProduct implements Node {
    id: ID!
    variantId: ID!
    name: String!
    price: Int!
    imageUrl: String
    sortOrder: Int!
}

type LiveRoomList implements PaginatedList {
    items: [LiveRoom!]!
    totalItems: Int!
}

input LiveRoomListOptions
`;
let LiveStreamingPlugin = class LiveStreamingPlugin {
    static { LiveStreamingPlugin_1 = this; }
    options;
    liveRoomService;
    liveCommissionService;
    moduleRef;
    static options = {};
    injector;
    constructor(options, liveRoomService, liveCommissionService, moduleRef) {
        this.options = options;
        this.liveRoomService = liveRoomService;
        this.liveCommissionService = liveCommissionService;
        this.moduleRef = moduleRef;
    }
    static init(options) {
        LiveStreamingPlugin_1.options = options ?? {};
        return LiveStreamingPlugin_1;
    }
    async onApplicationBootstrap() {
        this.injector = new core_2.Injector(this.moduleRef);
        this.liveRoomService.setOptions(this.options);
        this.liveCommissionService.setOptions(this.options);
        await this.liveCommissionService.init();
        core_2.Logger.info('LiveStreamingPlugin initialized', constants_1.loggerCtx);
    }
};
exports.LiveStreamingPlugin = LiveStreamingPlugin;
exports.LiveStreamingPlugin = LiveStreamingPlugin = LiveStreamingPlugin_1 = __decorate([
    (0, core_2.VendurePlugin)({
        imports: [core_2.PluginCommonModule],
        entities: [live_room_entity_1.LiveRoom, live_room_product_entity_1.LiveRoomProduct],
        providers: [
            { provide: constants_1.LIVE_PLUGIN_OPTIONS, useFactory: () => LiveStreamingPlugin.options },
            live_room_service_1.LiveRoomService,
            live_commission_service_1.LiveCommissionService,
        ],
        exports: [live_room_service_1.LiveRoomService, live_commission_service_1.LiveCommissionService],
        adminApiExtensions: {
            schema: () => (0, graphql_tag_1.default) `
            ${liveRoomType}

            input CreateLiveRoomInput {
                name: String!
                coverUrl: String
                description: String
                streamerCustomerId: ID
                streamerName: String
                type: String
                scheduledStartAt: DateTime
            }

            input UpdateLiveRoomInput {
                id: ID!
                name: String
                coverUrl: String
                description: String
                streamerCustomerId: ID
                streamerName: String
                type: String
                scheduledStartAt: DateTime
            }

            input AddLiveRoomProductInput {
                variantId: ID!
                name: String!
                price: Int!
                imageUrl: String
                sortOrder: Int
            }

            extend type Query {
                liveRooms(options: LiveRoomListOptions): LiveRoomList!
                liveRoom(id: ID!): LiveRoom
            }

            extend type Mutation {
                createLiveRoom(input: CreateLiveRoomInput!): LiveRoom!
                updateLiveRoom(input: UpdateLiveRoomInput!): LiveRoom!
                deleteLiveRoom(id: ID!): Boolean!
                startLiveRoom(id: ID!): LiveRoom!
                stopLiveRoom(id: ID!, replayUrl: String): LiveRoom!
                addLiveRoomProduct(roomId: ID!, input: AddLiveRoomProductInput!): LiveRoom!
                removeLiveRoomProduct(roomId: ID!, productId: ID!): LiveRoom!
            }
        `,
            resolvers: [live_admin_resolver_1.LiveAdminResolver],
        },
        shopApiExtensions: {
            schema: () => (0, graphql_tag_1.default) `
            ${liveRoomType}
        `,
            resolvers: [live_shop_resolver_1.LiveShopResolver],
        },
        configuration: config => {
            config.customFields = {
                ...config.customFields,
                Order: [
                    ...(config.customFields?.Order ?? []),
                    { name: 'liveRoomId', type: 'int', nullable: true, label: [{ languageCode: 'zh_Hans', value: '直播间ID' }] },
                ],
            };
            return config;
        },
        compatibility: '^3.0.0',
    }),
    __param(0, (0, common_1.Inject)(constants_1.LIVE_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object, live_room_service_1.LiveRoomService,
        live_commission_service_1.LiveCommissionService,
        core_1.ModuleRef])
], LiveStreamingPlugin);

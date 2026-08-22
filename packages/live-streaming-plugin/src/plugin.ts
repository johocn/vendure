import { Inject, OnApplicationBootstrap, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Injector, Logger, PluginCommonModule, VendurePlugin } from '@vendure/core';
import gql from 'graphql-tag';

import { LIVE_PLUGIN_OPTIONS, loggerCtx } from './constants';
import { LiveRoom } from './live-room.entity';
import { LiveRoomProduct } from './live-room-product.entity';
import { LiveAdminResolver } from './live-admin.resolver';
import { LiveShopResolver } from './live-shop.resolver';
import { LiveRoomService } from './live-room.service';
import { LiveRoomShopService } from './live-room-shop.service';
import { LiveCommissionService } from './live-commission.service';
import { LiveStreamingPluginOptions } from './types';

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

input LiveRoomListOptions {
    take: Int
    skip: Int
}
`;

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [LiveRoom, LiveRoomProduct],
    providers: [
        { provide: LIVE_PLUGIN_OPTIONS, useFactory: () => LiveStreamingPlugin.options },
        LiveRoomService,
        LiveRoomShopService,
        LiveCommissionService,
    ],
    exports: [LiveRoomService, LiveCommissionService],
    adminApiExtensions: {
        schema: () => gql`
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
        resolvers: [LiveAdminResolver],
    },
    shopApiExtensions: {
        schema: () => gql`
            ${liveRoomType}

            type LiveRoomEnterResult {
                roomId: ID!
                playUrl: String
                pushUrl: String
                wsUrl: String!
                wsTicket: String!
            }

            extend type Query {
                liveRooms(status: String): [LiveRoom!]!
                liveRoom(id: ID!): LiveRoom!
                liveRoomProducts(id: ID!): [LiveRoomProduct!]!
            }

            extend type Mutation {
                enterLiveRoom(roomId: ID!): LiveRoomEnterResult!
                setOrderLiveRoom(roomId: ID!): Order!
            }
        `,
        resolvers: [LiveShopResolver],
    },
    configuration: config => {
        config.customFields = {
            ...config.customFields,
            Order: [
                ...(config.customFields?.Order ?? []),
                { name: 'liveRoomId', type: 'int', nullable: true, label: [{ languageCode: 'zh_Hans' as any, value: '直播间ID' }] },
            ],
        };
        return config;
    },
    compatibility: '^3.0.0',
})
export class LiveStreamingPlugin implements OnApplicationBootstrap {
    private static options: LiveStreamingPluginOptions = {};
    private injector: Injector;

    constructor(
        @Inject(LIVE_PLUGIN_OPTIONS) private options: LiveStreamingPluginOptions,
        private liveRoomService: LiveRoomService,
        private liveRoomShopService: LiveRoomShopService,
        private liveCommissionService: LiveCommissionService,
        private moduleRef: ModuleRef,
    ) {}

    static init(options?: LiveStreamingPluginOptions): Type<LiveStreamingPlugin> {
        LiveStreamingPlugin.options = options ?? {};
        return LiveStreamingPlugin;
    }

    async onApplicationBootstrap(): Promise<void> {
        this.injector = new Injector(this.moduleRef);
        this.liveRoomService.setOptions(this.options);
        this.liveRoomShopService.setOptions(this.options);
        this.liveCommissionService.setOptions(this.options);
        await this.liveCommissionService.init();
        Logger.info('LiveStreamingPlugin initialized', loggerCtx);
    }
}

import { Inject, OnApplicationBootstrap, Type } from '@nestjs/common';
import {
    ConfigService,
    EventBus,
    Logger,
    OrderStateTransitionEvent,
    PluginCommonModule,
    VendurePlugin,
} from '@vendure/core';

import { checkinChannelCustomFields } from './channel-custom-fields';
import { CheckinRecord } from './checkin-record.entity';
import { TaskRecord } from './task-record.entity';
import { CheckinService } from './checkin.service';
import { CheckinShopResolver } from './checkin-shop.resolver';
import { CHECKIN_PLUGIN_OPTIONS, loggerCtx } from './constants';
import { CheckinPluginOptions } from './types';

const { gql } = require('graphql-tag');

function mergeCustomFields<T extends { name: string }>(existing: T[] | undefined, additions: T[] | undefined): T[] {
    const names = new Set((existing ?? []).map(f => f.name));
    return [...(existing ?? []), ...(additions ?? []).filter(f => !names.has(f.name))];
}

const shopSchema = () => gql`
    type CheckinResult {
        success: Boolean!
        reason: String
        points: Int
        growth: Int
        streak: Int
    }
    type CheckinTodayInfo {
        checkedIn: Boolean!
        streak: Int!
        canCheckin: Boolean!
    }
    type TaskSummary {
        taskCode: String!
        state: String!
        points: Int!
        growth: Int!
    }
    extend type Query {
        checkinToday: CheckinTodayInfo!
        myTasks: [TaskSummary!]!
    }
    extend type Mutation {
        checkin: CheckinResult!
        claimTask(taskCode: String!): CheckinResult!
    }
`;

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [CheckinRecord, TaskRecord],
    providers: [
        { provide: CHECKIN_PLUGIN_OPTIONS, useFactory: () => CheckinPlugin.options },
        CheckinService,
    ],
    shopApiExtensions: {
        schema: shopSchema,
        resolvers: [CheckinShopResolver],
    },
    configuration: (config) => {
        config.customFields.Channel = mergeCustomFields(config.customFields.Channel, checkinChannelCustomFields.Channel);
        return config;
    },
    compatibility: '^3.0.0',
})
export class CheckinPlugin implements OnApplicationBootstrap {
    static options: CheckinPluginOptions = {};

    constructor(
        @Inject(CHECKIN_PLUGIN_OPTIONS) private options: CheckinPluginOptions,
        private checkinService: CheckinService,
        private eventBus: EventBus,
        private configService: ConfigService,
    ) {}

    static init(options?: CheckinPluginOptions): Type<CheckinPlugin> {
        CheckinPlugin.options = options ?? {};
        return CheckinPlugin;
    }

    async onApplicationBootstrap(): Promise<void> {
        this.eventBus.ofType(OrderStateTransitionEvent).subscribe((event) => {
            if (event.toState === 'Delivered' && event.order.customer) {
                const shippingMethodContext = event.ctx;
                void this.checkinService
                    .awardMilestones(shippingMethodContext, event.order.customer.id)
                    .catch((e: any) => Logger.error(`checkin milestone award failed: ${e?.message ?? e}`, loggerCtx));
            }
        });
        Logger.info('CheckinPlugin initialized', loggerCtx);
    }
}
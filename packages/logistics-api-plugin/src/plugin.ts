import { Inject, Type } from '@nestjs/common';
import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import gql from 'graphql-tag';

import { loggerCtx, LOGISTICS_API_PLUGIN_OPTIONS } from './constants';
import { logisticsApiChannelCustomFields } from './channel-custom-fields';
import { LogisticsApiAdminResolver } from './logistics-api-admin.resolver';
import { LogisticsQueryService } from './logistics-query.service';
import { LogisticsApiPluginOptions } from './types';

/** Idempotently merge custom fields, deduplicating by field name (preBootstrapConfig may run plugin configurations multiple times). */
function mergeCustomFields<T extends { name: string }>(
    existingFields: T[] | undefined,
    additions: T[] | undefined,
): T[] {
    const names = new Set((existingFields ?? []).map(f => f.name));
    return [...(existingFields ?? []), ...(additions ?? []).filter(f => !names.has(f.name))];
}

@VendurePlugin({
    imports: [PluginCommonModule],
    providers: [
        { provide: LOGISTICS_API_PLUGIN_OPTIONS, useFactory: () => LogisticsApiPlugin.options },
        LogisticsQueryService,
    ],
    adminApiExtensions: {
        schema: () => gql`
            type TrackingTrace {
                time: String!
                status: String!
                description: String!
            }

            type TrackingResult {
                carrierCode: String!
                trackingNumber: String!
                traces: [TrackingTrace!]!
            }

            type CarrierDetectResult {
                code: String!
                name: String!
            }

            extend type Query {
                logisticsTracking(carrierCode: String!, trackingNumber: String!): TrackingResult!
                detectCarrier(trackingNumber: String!): [CarrierDetectResult!]!
            }
        `,
        resolvers: [LogisticsApiAdminResolver],
    },
    configuration: (config) => {
        config.customFields.Channel = mergeCustomFields(config.customFields.Channel, logisticsApiChannelCustomFields.Channel);
        return config;
    },
    dashboard: '../dashboard/index.tsx',
    compatibility: '^3.0.0',
})
export class LogisticsApiPlugin {
    private static options: LogisticsApiPluginOptions = {};

    constructor(@Inject(LOGISTICS_API_PLUGIN_OPTIONS) private options: LogisticsApiPluginOptions) {}

    static init(options?: LogisticsApiPluginOptions): Type<LogisticsApiPlugin> {
        LogisticsApiPlugin.options = options ?? {};
        return LogisticsApiPlugin;
    }
}

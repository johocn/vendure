import { Inject, Type } from '@nestjs/common';
import { PluginCommonModule, VendurePlugin } from '@vendure/core';

import { TCM_PLUGIN_OPTIONS } from './constants';
import { TcmClinic } from './entities/tcm-clinic.entity';
import { TcmAdminResolver } from './resolvers/tcm-admin.resolver';
import { TcmClinicService } from './services/tcm-clinic.service';
import { TcmClinicPluginOptions } from './types';

const { gql } = require('graphql-tag');

const adminSchema = () => gql`
    type TcmClinic {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        name: String!
        licenseNo: String!
        address: String
        status: String!
    }
    input TcmClinicInput {
        name: String!
        licenseNo: String!
        address: String
    }
    extend type Query {
        clinics(options: TcmClinicListOptions): TcmClinicList!
    }
    input TcmClinicListOptions {
        skip: Int
        take: Int
    }
    type TcmClinicList {
        items: [TcmClinic!]!
        totalItems: Int!
    }
    extend type Mutation {
        createClinic(input: TcmClinicInput!): TcmClinic!
    }
`;

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [TcmClinic],
    providers: [
        { provide: TCM_PLUGIN_OPTIONS, useFactory: () => TcmClinicPlugin.options },
        TcmClinicService,
    ],
    adminApiExtensions: {
        schema: adminSchema,
        resolvers: [TcmAdminResolver],
    },
    compatibility: '^3.0.0',
})
export class TcmClinicPlugin {
    static options: TcmClinicPluginOptions = {};

    static init(options?: TcmClinicPluginOptions): Type<TcmClinicPlugin> {
        TcmClinicPlugin.options = options ?? {};
        return TcmClinicPlugin;
    }
}

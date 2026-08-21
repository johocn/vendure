import { Inject, Type } from '@nestjs/common';
import {
    PermissionDefinition,
    PluginCommonModule,
    VendurePlugin,
} from '@vendure/core';

import { OPERATION_PLUGIN_OPTIONS } from './constants';
import { OperationAdminResolver } from './operation-admin.resolver';
import { OperationSection } from './operation-section.entity';
import { OperationItem } from './operation-item.entity';
import { OperationService } from './operation.service';
import { OperationShopResolver } from './operation-shop.resolver';
import { OperationPluginOptions } from './types';

const { gql } = require('graphql-tag');

const adminSchema = () => gql`
    type OperationItem {
        id: ID!
        type: String!
        sortOrder: Int!
        title: String
        imageAssetId: ID
        linkUrl: String
        productId: ID
    }

    type OperationSection implements Node {
        id: ID!
        code: String!
        name: String!
        type: String!
        displayMode: String
        enabled: Boolean!
        position: Int!
        items: [OperationItem!]!
    }

    input OperationListOptions {
        skip: Int
        take: Int
    }

    input CreateOperationSectionInput {
        code: String!
        name: String!
        type: String!
        displayMode: String
        position: Int
        enabled: Boolean
    }

    input UpdateOperationSectionInput {
        name: String
        type: String
        displayMode: String
        position: Int
        enabled: Boolean
    }

    input OperationItemInput {
        type: String!
        sortOrder: Int!
        title: String
        imageAssetId: ID
        linkUrl: String
        productId: ID
    }

    extend type Query {
        operationSections(options: OperationListOptions): [OperationSection!]!
        operationSection(code: String!): OperationSection
    }

    extend type Mutation {
        createOperationSection(input: CreateOperationSectionInput!): OperationSection!
        updateOperationSection(id: ID!, input: UpdateOperationSectionInput!): OperationSection!
        deleteOperationSection(id: ID!): Boolean!
        setOperationItems(sectionId: ID!, items: [OperationItemInput!]!): [OperationItem!]!
    }
`;

const shopSchema = () => gql`
    type OperationItem {
        id: ID!
        type: String!
        sortOrder: Int!
        title: String
        imageUrl: String
        linkUrl: String
        product: Product
    }

    type OperationSection implements Node {
        id: ID!
        code: String!
        name: String!
        type: String!
        displayMode: String
        position: Int!
        items: [OperationItem!]!
    }

    input OperationListOptions {
        skip: Int
        take: Int
    }

    extend type Query {
        operationSections(options: OperationListOptions): [OperationSection!]!
        operationSection(code: String!): OperationSection
    }
`;

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [OperationSection, OperationItem],
    providers: [
        { provide: OPERATION_PLUGIN_OPTIONS, useFactory: () => OperationPlugin.options },
        OperationService,
    ],
    adminApiExtensions: {
        schema: adminSchema,
        resolvers: [OperationAdminResolver],
    },
    shopApiExtensions: {
        schema: shopSchema,
        resolvers: [OperationShopResolver],
    },
    configuration: (config) => config,
    compatibility: '^3.0.0',
})
export class OperationPlugin {
    private static options: OperationPluginOptions = {};

    constructor(@Inject(OPERATION_PLUGIN_OPTIONS) private options: OperationPluginOptions) {}

    static init(options?: OperationPluginOptions): Type<OperationPlugin> {
        OperationPlugin.options = options ?? {};
        return OperationPlugin;
    }
}
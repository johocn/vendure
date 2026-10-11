import { Inject, Injectable, OnApplicationBootstrap, Type } from '@nestjs/common';
import { Logger, PluginCommonModule, TransactionalConnection, VendurePlugin } from '@vendure/core';
import gql from 'graphql-tag';

import { loggerCtx, PLUGIN_INIT_OPTIONS } from './constants';
import { DiyAdminResolver } from './diy-admin.resolver';
import { DiyService } from './diy.service';
import { DiyShopResolver } from './diy-shop.resolver';
import { DiyShopService } from './diy-shop.service';
import { DiyCategory } from './entities/diy-category.entity';
import { DiyMaterial } from './entities/diy-material.entity';
import { DiyTemplate } from './entities/diy-template.entity';
import { DiyCreate, DiyDelete, DiyRead, DiyUpdate } from './permissions';
import { seedDiy } from './seed';
import { DiyPluginOptions } from './types';

const adminSchema = gql`
    type DiyCategory implements Node {
        id: ID!
        app: String
        code: String
        parentId: Int
        name: JSON
        image: String
        sortOrder: Int!
        enabled: Boolean!
        createdAt: DateTime!
        updatedAt: DateTime!
    }
    type DiyMaterial implements Node {
        id: ID!
        app: String
        code: String!
        name: JSON
        categoryId: Int!
        shape: String!
        diameter: Float
        axialLength: Float
        holeSize: Float
        attrs: JSON
        render: JSON
        price: Int!
        priceUnit: String!
        currency: String!
        stock: Int!
        images: JSON
        sourceMaterialId: Int
        enabled: Boolean!
        sortOrder: Int!
        createdAt: DateTime!
        updatedAt: DateTime!
    }
    type DiyTemplate implements Node {
        id: ID!
        app: String
        code: String!
        name: JSON
        description: JSON
        thumb: String
        images: JSON
        config: JSON
        calculatorKey: String
        status: String!
        version: Int!
        sortOrder: Int!
        createdAt: DateTime!
        updatedAt: DateTime!
    }
    input DiyCategoryInput {
        id: ID
        app: String
        code: String
        parentId: Int
        name: JSON
        image: String
        sortOrder: Int
        enabled: Boolean
    }
    input DiyMaterialInput {
        id: ID
        app: String
        code: String
        name: JSON
        categoryId: Int
        shape: String
        diameter: Float
        axialLength: Float
        holeSize: Float
        attrs: JSON
        render: JSON
        price: Int
        priceUnit: String
        currency: String
        stock: Int
        images: JSON
        enabled: Boolean
        sortOrder: Int
    }
    input DiyTemplateInput {
        id: ID
        app: String
        code: String
        name: JSON
        description: JSON
        thumb: String
        images: JSON
        config: JSON
        calculatorKey: String
        status: String
        sortOrder: Int
    }
    extend type Query {
        diyCategories(app: String): [DiyCategory!]!
        diyCategory(id: ID!): DiyCategory
        diyMaterials(app: String, skip: Int, take: Int): [DiyMaterial!]!
        diyMaterial(id: ID!): DiyMaterial
        diyTemplates(app: String): [DiyTemplate!]!
        diyTemplate(id: ID!): DiyTemplate
    }
    extend type Mutation {
        createDiyCategory(input: DiyCategoryInput!): DiyCategory!
        updateDiyCategory(input: DiyCategoryInput!): DiyCategory!
        deleteDiyCategory(id: ID!): Boolean!
        createDiyMaterial(input: DiyMaterialInput!): DiyMaterial!
        updateDiyMaterial(input: DiyMaterialInput!): DiyMaterial!
        deleteDiyMaterial(id: ID!): Boolean!
        copyDiyMaterial(id: ID!): DiyMaterial!
        diyMaterialsImport(input: JSON!): Int!
        createDiyTemplate(input: DiyTemplateInput!): DiyTemplate!
        updateDiyTemplate(input: DiyTemplateInput!): DiyTemplate!
        deleteDiyTemplate(id: ID!): Boolean!
        publishDiyTemplate(id: ID!): DiyTemplate!
        copyDiyTemplate(id: ID!): DiyTemplate!
    }
`;

const shopSchema = gql`
    type DiyMaterial {
        id: ID!
        app: String
        code: String!
        name: JSON
        categoryId: Int!
        shape: String!
        diameter: Float
        axialLength: Float
        holeSize: Float
        attrs: JSON
        render: JSON
        price: Int!
        priceUnit: String!
        currency: String!
        stock: Int!
        images: JSON
        enabled: Boolean!
        sortOrder: Int!
        createdAt: DateTime!
        updatedAt: DateTime!
    }
    type DiyMaterialList {
        items: [DiyMaterial!]!
        total: Int!
    }
    type DiyTemplate {
        id: ID!
        app: String
        code: String!
        name: JSON
        description: JSON
        thumb: String
        images: JSON
        config: JSON
        calculatorKey: String
        status: String!
        version: Int!
        sortOrder: Int!
        createdAt: DateTime!
        updatedAt: DateTime!
    }
    extend type Query {
        diyMaterials(filter: JSON): DiyMaterialList!
        diyShopTemplates: [DiyTemplate!]!
        diyShopTemplate(code: String!): DiyTemplate
    }
`;

@Injectable()
export class DiySeedRunner {
    constructor(private connection: TransactionalConnection) {}
    async run(): Promise<void> {
        await seedDiy(this.connection);
    }
}

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [DiyCategory, DiyMaterial, DiyTemplate],
    providers: [
        { provide: PLUGIN_INIT_OPTIONS, useFactory: () => DiyPlugin.options },
        DiyService,
        DiyShopService,
        DiySeedRunner,
    ],
    exports: [DiyService],
    adminApiExtensions: {
        schema: () => adminSchema,
        resolvers: [DiyAdminResolver],
    },
    shopApiExtensions: {
        schema: () => shopSchema,
        resolvers: [DiyShopResolver],
    },
    configuration: config => {
        config.authOptions.customPermissions.push(DiyRead, DiyCreate, DiyUpdate, DiyDelete);
        return config;
    },
    compatibility: '^3.0.0',
})
export class DiyPlugin implements OnApplicationBootstrap {
    private static options: DiyPluginOptions = {};

    static init(options?: DiyPluginOptions): Type<DiyPlugin> {
        DiyPlugin.options = options ?? {};
        return DiyPlugin;
    }

    constructor(
        @Inject(PLUGIN_INIT_OPTIONS) private options: DiyPluginOptions,
        private seedRunner: DiySeedRunner,
    ) {}

    async onApplicationBootstrap(): Promise<void> {
        await this.seedRunner.run();
        Logger.info('DiyPlugin initialized', loggerCtx);
    }
}

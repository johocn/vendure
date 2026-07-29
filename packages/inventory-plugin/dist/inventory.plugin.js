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
var InventoryPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryPlugin = void 0;
const core_1 = require("@nestjs/core");
const core_2 = require("@vendure/core");
const inventory_admin_resolver_1 = require("./inventory-admin.resolver");
const inventory_service_1 = require("./inventory.service");
const role_sync_1 = require("./role-sync");
const stock_in_order_entity_1 = require("./entities/stock-in-order.entity");
const stock_out_order_entity_1 = require("./entities/stock-out-order.entity");
const stock_move_order_entity_1 = require("./entities/stock-move-order.entity");
const stocktake_order_entity_1 = require("./entities/stocktake-order.entity");
const loggerCtx = 'InventoryPlugin';
const { gql } = require('graphql-tag');
let InventoryPlugin = InventoryPlugin_1 = class InventoryPlugin {
    constructor(moduleRef) {
        this.moduleRef = moduleRef;
    }
    async onApplicationBootstrap() {
        var _a;
        core_2.Logger.info('onApplicationBootstrap called', loggerCtx);
        if (!this.moduleRef) {
            return;
        }
        try {
            const injector = new core_2.Injector(this.moduleRef);
            const roleSync = new role_sync_1.RoleSyncService();
            roleSync.init(injector);
            await roleSync.syncRoles();
        }
        catch (err) {
            core_2.Logger.error(`Bootstrap failed: ${(_a = err === null || err === void 0 ? void 0 : err.message) !== null && _a !== void 0 ? _a : err}`, loggerCtx);
        }
    }
};
exports.InventoryPlugin = InventoryPlugin;
InventoryPlugin.init = () => InventoryPlugin_1;
exports.InventoryPlugin = InventoryPlugin = InventoryPlugin_1 = __decorate([
    (0, core_2.VendurePlugin)({
        imports: [core_2.PluginCommonModule],
        providers: [inventory_service_1.InventoryService],
        entities: [
            stock_in_order_entity_1.StockInOrder, stock_in_order_entity_1.StockInOrderLine,
            stock_out_order_entity_1.StockOutOrder, stock_out_order_entity_1.StockOutOrderLine,
            stock_move_order_entity_1.StockMoveOrder, stock_move_order_entity_1.StockMoveOrderLine,
            stocktake_order_entity_1.StocktakeOrder, stocktake_order_entity_1.StocktakeOrderLine,
        ],
        adminApiExtensions: {
            schema: () => gql `
            type StockLevelList {
                items: [StockLevel!]!
                totalItems: Int!
            }

            type StockInOrderLine {
                id: ID!
                productVariantId: ID!
                quantity: Int!
                unitPrice: Int
            }
            type StockInOrder {
                id: ID!
                code: String!
                state: String!
                type: String
                note: String
                staffId: String
                targetLocationId: ID!
                targetLocation: StockLocation
                lines: [StockInOrderLine!]!
                completedAt: DateTime
                cancelledAt: DateTime
                createdAt: DateTime!
                updatedAt: DateTime!
            }
            type StockInOrderList {
                items: [StockInOrder!]!
                totalItems: Int!
            }

            type StockOutOrderLine {
                id: ID!
                productVariantId: ID!
                quantity: Int!
                unitPrice: Int
            }
            type StockOutOrder {
                id: ID!
                code: String!
                state: String!
                type: String
                note: String
                staffId: String
                sourceLocationId: ID!
                sourceLocation: StockLocation
                lines: [StockOutOrderLine!]!
                completedAt: DateTime
                cancelledAt: DateTime
                createdAt: DateTime!
                updatedAt: DateTime!
            }
            type StockOutOrderList {
                items: [StockOutOrder!]!
                totalItems: Int!
            }

            type StockMoveOrderLine {
                id: ID!
                productVariantId: ID!
                quantity: Int!
            }
            type StockMoveOrder {
                id: ID!
                code: String!
                state: String!
                note: String
                staffId: String
                sourceLocationId: ID!
                sourceLocation: StockLocation
                targetLocationId: ID!
                targetLocation: StockLocation
                lines: [StockMoveOrderLine!]!
                shippedAt: DateTime
                receivedAt: DateTime
                completedAt: DateTime
                cancelledAt: DateTime
                createdAt: DateTime!
                updatedAt: DateTime!
            }
            type StockMoveOrderList {
                items: [StockMoveOrder!]!
                totalItems: Int!
            }

            type StocktakeOrderLine {
                id: ID!
                productVariantId: ID!
                systemQuantity: Int!
                countedQuantity: Int!
                difference: Int!
                reconciled: Boolean!
            }
            type StocktakeOrder {
                id: ID!
                code: String!
                state: String!
                note: String
                staffId: String
                locationId: ID!
                location: StockLocation
                lines: [StocktakeOrderLine!]!
                countingStartedAt: DateTime
                reconcilingStartedAt: DateTime
                completedAt: DateTime
                cancelledAt: DateTime
                createdAt: DateTime!
                updatedAt: DateTime!
            }
            type StocktakeOrderList {
                items: [StocktakeOrder!]!
                totalItems: Int!
            }

            input StockInLineInput {
                productVariantId: ID!
                quantity: Int!
                unitPrice: Int
            }
            input CreateStockInOrderInput {
                type: String
                note: String
                targetLocationId: ID!
                lines: [StockInLineInput!]!
            }

            input StockOutLineInput {
                productVariantId: ID!
                quantity: Int!
                unitPrice: Int
            }
            input CreateStockOutOrderInput {
                type: String
                note: String
                sourceLocationId: ID!
                lines: [StockOutLineInput!]!
            }

            input StockMoveLineInput {
                productVariantId: ID!
                quantity: Int!
            }
            input CreateStockMoveOrderInput {
                note: String
                sourceLocationId: ID!
                targetLocationId: ID!
                lines: [StockMoveLineInput!]!
            }

            input CreateStocktakeOrderInput {
                note: String
                locationId: ID!
                productVariantIds: [ID!]!
            }

            input StocktakeCountInput {
                lineId: ID!
                countedQuantity: Int!
            }

            extend type Query {
                stockLevels(locationId: ID, page: Int, pageSize: Int): StockLevelList!
                stockMovements(productVariantId: ID, locationId: ID, type: String, page: Int, pageSize: Int): StockMovementList!

                stockInOrders(state: String, page: Int, pageSize: Int): StockInOrderList!
                stockInOrder(id: ID!): StockInOrder

                stockOutOrders(state: String, page: Int, pageSize: Int): StockOutOrderList!
                stockOutOrder(id: ID!): StockOutOrder

                stockMoveOrders(state: String, page: Int, pageSize: Int): StockMoveOrderList!
                stockMoveOrder(id: ID!): StockMoveOrder

                stocktakeOrders(state: String, page: Int, pageSize: Int): StocktakeOrderList!
                stocktakeOrder(id: ID!): StocktakeOrder
            }

            extend type Mutation {
                createStockInOrder(input: CreateStockInOrderInput!): StockInOrder!
                completeStockInOrder(id: ID!): StockInOrder!
                cancelStockInOrder(id: ID!): StockInOrder!

                createStockOutOrder(input: CreateStockOutOrderInput!): StockOutOrder!
                completeStockOutOrder(id: ID!): StockOutOrder!
                cancelStockOutOrder(id: ID!): StockOutOrder!

                createStockMoveOrder(input: CreateStockMoveOrderInput!): StockMoveOrder!
                shipStockMoveOrder(id: ID!): StockMoveOrder!
                receiveStockMoveOrder(id: ID!): StockMoveOrder!
                completeStockMoveOrder(id: ID!): StockMoveOrder!
                cancelStockMoveOrder(id: ID!): StockMoveOrder!

                createStocktakeOrder(input: CreateStocktakeOrderInput!): StocktakeOrder!
                startCountingStocktake(id: ID!): StocktakeOrder!
                submitStocktakeCount(id: ID!, counts: [StocktakeCountInput!]!): StocktakeOrder!
                reconcileStocktakeLine(orderId: ID!, lineId: ID!): StocktakeOrder!
                completeStocktakeOrder(id: ID!): StocktakeOrder!
                cancelStocktakeOrder(id: ID!): StocktakeOrder!
            }
        `,
            resolvers: [inventory_admin_resolver_1.InventoryAdminResolver],
        },
        configuration: (config) => {
            var _a;
            config.customFields.StockMovement = [
                ...((_a = config.customFields.StockMovement) !== null && _a !== void 0 ? _a : []),
                { name: 'businessReason', type: 'string', nullable: true },
            ];
            return config;
        },
        compatibility: '^3.6.0',
    }),
    __metadata("design:paramtypes", [core_1.ModuleRef])
], InventoryPlugin);

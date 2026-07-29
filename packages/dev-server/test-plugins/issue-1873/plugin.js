"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var IssueSupplierPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.IssueSupplierPlugin = void 0;
const core_1 = require("@vendure/core");
const supplier_stock_admin_resolver_1 = require("./api/resolvers/admin/supplier-stock-admin.resolver");
const supplier_stock_in_transit_admin_resolver_1 = require("./api/resolvers/admin/supplier-stock-in-transit-admin.resolver");
const suppiler_stock_entity_resolver_1 = require("./api/resolvers/entity/suppiler-stock-entity.resolver");
const admin_api_1 = require("./api/schema/admin-api");
const supplier_stock_in_transit_service_1 = require("./api/services/supplier-stock-in-transit.service");
const supplier_stock_service_1 = require("./api/services/supplier-stock.service");
const constants_1 = require("./constants");
const product_variant_custom_fields_1 = require("./custom-fields/product-variant-custom-fields");
const supplier_stock_in_transit_entity_1 = require("./entities/supplier-stock-in-transit.entity");
const supplier_stock_entity_1 = require("./entities/supplier-stock.entity");
const services = [supplier_stock_in_transit_service_1.SupplierStockInTransitService, supplier_stock_service_1.SupplierStockService];
let IssueSupplierPlugin = IssueSupplierPlugin_1 = class IssueSupplierPlugin {
    /**
     * The static `init()` method is a convention used by Vendure plugins which allows options
     * to be configured by the user.
     */
    static init(options) {
        this.options = Object.assign(Object.assign({}, IssueSupplierPlugin_1.options), options);
        return IssueSupplierPlugin_1;
    }
};
exports.IssueSupplierPlugin = IssueSupplierPlugin;
IssueSupplierPlugin.options = {};
exports.IssueSupplierPlugin = IssueSupplierPlugin = IssueSupplierPlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        entities: [supplier_stock_entity_1.SupplierStock, supplier_stock_in_transit_entity_1.SupplierStockInTransit],
        adminApiExtensions: {
            schema: admin_api_1.adminApiExtensions,
            resolvers: [
                supplier_stock_admin_resolver_1.SupplierStockAdminResolver,
                suppiler_stock_entity_resolver_1.SupplierStockEntityResolver,
                supplier_stock_in_transit_admin_resolver_1.SupplierStockInTransitAdminResolver,
            ],
        },
        providers: [
            ...services,
            // By definiting the `PLUGIN_INIT_OPTIONS` symbol as a provider, we can then inject the
            // user-defined options into other classes, such as the {@link ExampleService}.
            {
                provide: constants_1.PLUGIN_INIT_OPTIONS,
                useFactory: () => IssueSupplierPlugin.options,
            },
        ],
        configuration: (config) => {
            config.customFields.ProductVariant.push(...product_variant_custom_fields_1.productVariantCustomFields);
            return config;
        },
    })
], IssueSupplierPlugin);
//# sourceMappingURL=plugin.js.map
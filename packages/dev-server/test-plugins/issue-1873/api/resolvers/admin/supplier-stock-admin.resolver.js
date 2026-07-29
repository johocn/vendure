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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupplierStockAdminResolver = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const constants_1 = require("../../../constants");
const supplier_stock_in_transit_entity_1 = require("../../../entities/supplier-stock-in-transit.entity");
const supplier_stock_entity_1 = require("../../../entities/supplier-stock.entity");
const initial_data_1 = require("../../schema/admin-api/initial-data");
const supplier_stock_service_1 = require("../../services/supplier-stock.service");
let SupplierStockAdminResolver = class SupplierStockAdminResolver {
    constructor(supplierStockService, connection, populator, channelService, productService, importer) {
        this.supplierStockService = supplierStockService;
        this.connection = connection;
        this.populator = populator;
        this.channelService = channelService;
        this.productService = productService;
        this.importer = importer;
    }
    async supplierStocks(ctx, args, relations) {
        return this.supplierStockService.findAll(ctx, args.options, relations);
    }
    async initVendureData(ctx) {
        const channel = await this.channelService.getDefaultChannel();
        await this.populator.populateInitialData(initial_data_1.initialData, channel);
        const assetsDir = path_1.default.join(__dirname, '../../../../mock-data');
        const productsCsvPath = path_1.default.join(assetsDir, '/data-sources/products.csv');
        const productData = await fs_1.default.readFileSync(productsCsvPath, 'utf-8');
        const importResult = await this.importer
            .parseAndImport(productData, ctx, true)
            .toPromise();
        if (importResult.errors && importResult.errors.length) {
            const errorFile = path_1.default.join(process.cwd(), 'vendure-import-error.log');
            core_1.Logger.error(`${importResult.errors.length} errors encountered when importing product data. See: ${errorFile}`, constants_1.LOGGER_CTX);
        }
        core_1.Logger.info(`Imported ${importResult.imported} products`, constants_1.LOGGER_CTX);
        await this.populator.populateCollections(initial_data_1.initialData, channel);
    }
    async initializeDemo(ctx) {
        const { totalItems } = await this.productService.findAll(ctx, {});
        if (totalItems === 0) {
            await this.initVendureData(ctx);
        }
        const supplierStock = await this.connection
            .getRepository(ctx, supplier_stock_entity_1.SupplierStock)
            .save({
            comment: 'stock comment',
            enabled: true,
            link: 'stock link',
            inTransitsStock: 10,
            stockArea: 'stock area',
            productId: 1,
            productVariantId: 1,
        });
        await this.connection.getRepository(ctx, supplier_stock_in_transit_entity_1.SupplierStockInTransit).save({
            channelName: 'channel name',
            channelOrderNo: 'channel order number',
            quantity: 5,
            supplierStockId: supplierStock.id,
        });
        return true;
    }
};
exports.SupplierStockAdminResolver = SupplierStockAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __param(2, (0, core_1.Relations)({
        entity: supplier_stock_entity_1.SupplierStock,
        omit: ['productVariant'],
    })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Array]),
    __metadata("design:returntype", Promise)
], SupplierStockAdminResolver.prototype, "supplierStocks", null);
__decorate([
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], SupplierStockAdminResolver.prototype, "initVendureData", null);
__decorate([
    (0, graphql_1.Mutation)(),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], SupplierStockAdminResolver.prototype, "initializeDemo", null);
exports.SupplierStockAdminResolver = SupplierStockAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [supplier_stock_service_1.SupplierStockService,
        core_1.TransactionalConnection,
        core_1.Populator,
        core_1.ChannelService,
        core_1.ProductService,
        core_1.Importer])
], SupplierStockAdminResolver);
//# sourceMappingURL=supplier-stock-admin.resolver.js.map
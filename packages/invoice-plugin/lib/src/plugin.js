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
var InvoicePlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvoicePlugin = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const core_2 = require("@vendure/core");
const constants_1 = require("./constants");
const order_custom_fields_1 = require("./order-custom-fields");
const invoice_entity_1 = require("./invoice.entity");
const invoice_service_1 = require("./invoice.service");
const invoice_admin_resolver_1 = require("./invoice-admin.resolver");
const invoice_shop_resolver_1 = require("./invoice-shop.resolver");
const { gql } = require('graphql-tag');
const adminSchema = () => gql `
    type Invoice implements Node {
        id: ID!
        invoiceType: String!
        status: String!
        title: String!
        taxNumber: String
        email: String
        companyAddress: String
        companyPhone: String
        bankName: String
        bankAccount: String
        amount: Int!
        customerId: ID!
        orderIds: [ID!]!
        pdfUrl: String
        issuedAt: DateTime
        reversedAt: DateTime
        reverseReason: String
        providerInvoiceNo: String
        lastError: String
        createdAt: DateTime!
        updatedAt: DateTime!
    }

    type InvoiceList implements PaginatedList {
        items: [Invoice!]!
        totalItems: Int!
    }

    input InvoiceListOptions

    extend type Query {
        invoices(options: InvoiceListOptions): InvoiceList!
        invoice(id: ID!): Invoice
    }

    extend type Mutation {
        issueInvoice(id: ID!): Invoice!
        reverseInvoice(id: ID!, reason: String!): Invoice!
    }
`;
const shopSchema = () => gql `
    type Invoice implements Node {
        id: ID!
        invoiceType: String!
        status: String!
        title: String!
        taxNumber: String
        email: String
        companyAddress: String
        companyPhone: String
        bankName: String
        bankAccount: String
        amount: Int!
        customerId: ID!
        orderIds: [ID!]!
        pdfUrl: String
        issuedAt: DateTime
        reversedAt: DateTime
        reverseReason: String
        providerInvoiceNo: String
        lastError: String
        createdAt: DateTime!
        updatedAt: DateTime!
    }

    input CreateInvoiceInput {
        orderIds: [ID!]!
        invoiceType: String!
        title: String!
        taxNumber: String
        email: String
        companyAddress: String
        companyPhone: String
        bankName: String
        bankAccount: String
    }

    extend type Query {
        myInvoices: [Invoice!]!
        myInvoice(id: ID!): Invoice
    }

    extend type Mutation {
        createInvoice(input: CreateInvoiceInput!): Invoice!
        downloadInvoicePdf(id: ID!): Invoice!
    }
`;
let InvoicePlugin = InvoicePlugin_1 = class InvoicePlugin {
    constructor(options, invoiceService, moduleRef) {
        this.options = options;
        this.invoiceService = invoiceService;
        this.moduleRef = moduleRef;
    }
    static init(options) {
        InvoicePlugin_1.options = options !== null && options !== void 0 ? options : {};
        return InvoicePlugin_1;
    }
    async onApplicationBootstrap() {
        this.injector = new core_2.Injector(this.moduleRef);
        this.invoiceService.init(this.injector);
        core_2.Logger.info('InvoicePlugin initialized', constants_1.loggerCtx);
    }
};
exports.InvoicePlugin = InvoicePlugin;
InvoicePlugin.options = {};
exports.InvoicePlugin = InvoicePlugin = InvoicePlugin_1 = __decorate([
    (0, core_2.VendurePlugin)({
        imports: [core_2.PluginCommonModule],
        entities: [invoice_entity_1.Invoice],
        providers: [
            { provide: constants_1.INVOICE_PLUGIN_OPTIONS, useFactory: () => InvoicePlugin.options },
            invoice_service_1.InvoiceService,
        ],
        adminApiExtensions: {
            schema: adminSchema,
            resolvers: [invoice_admin_resolver_1.InvoiceAdminResolver],
        },
        shopApiExtensions: {
            schema: shopSchema,
            resolvers: [invoice_shop_resolver_1.InvoiceShopResolver],
        },
        configuration: (config) => {
            var _a, _b;
            const existingOrderFields = (_a = config.customFields.Order) !== null && _a !== void 0 ? _a : [];
            const newOrderFields = (_b = order_custom_fields_1.invoiceOrderCustomFields.Order) !== null && _b !== void 0 ? _b : [];
            config.customFields.Order = [...existingOrderFields, ...newOrderFields];
            return config;
        },
        dashboard: '../dashboard/index.tsx',
        compatibility: '^3.0.0',
    }),
    __param(0, (0, common_1.Inject)(constants_1.INVOICE_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object, invoice_service_1.InvoiceService,
        core_1.ModuleRef])
], InvoicePlugin);
//# sourceMappingURL=plugin.js.map
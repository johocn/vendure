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
const invoice_title_entity_1 = require("./invoice-title.entity");
const invoice_title_service_1 = require("./invoice-title.service");
const invoice_title_shop_resolver_1 = require("./invoice-title-shop.resolver");
/** Idempotently merge custom fields, deduplicating by field name (preBootstrapConfig may run plugin configurations multiple times). */
function mergeCustomFields(existingFields, additions) {
    const names = new Set((existingFields !== null && existingFields !== void 0 ? existingFields : []).map(f => f.name));
    return [...(existingFields !== null && existingFields !== void 0 ? existingFields : []), ...(additions !== null && additions !== void 0 ? additions : []).filter(f => !names.has(f.name))];
}
const { gql } = require('graphql-tag');
const adminSchema = () => gql `
    type InvoiceLine {
        orderId: ID!
        orderCode: String!
        productVariantId: ID
        sku: String
        name: String!
        quantity: Int!
        unitPrice: Int!
        unitPriceWithTax: Int!
        amount: Int!
        taxRate: Int!
        taxAmount: Int!
        amountWithTax: Int!
    }

    type InvoiceTotals {
        totalExcludingTax: Int!
        totalTax: Int!
        totalWithTax: Int!
    }

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
        lines: [InvoiceLine!]
        totals: InvoiceTotals
        invoiceNo: String
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
        bulkIssueInvoices(ids: [ID!]!): [Invoice!]!
    }
`;
const shopSchema = () => gql `
    type InvoiceLine {
        orderId: ID!
        orderCode: String!
        productVariantId: ID
        sku: String
        name: String!
        quantity: Int!
        unitPrice: Int!
        unitPriceWithTax: Int!
        amount: Int!
        taxRate: Int!
        taxAmount: Int!
        amountWithTax: Int!
    }

    type InvoiceTotals {
        totalExcludingTax: Int!
        totalTax: Int!
        totalWithTax: Int!
    }

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
        lines: [InvoiceLine!]
        totals: InvoiceTotals
        invoiceNo: String
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
        invoiceTitleId: ID
    }

    extend type Query {
        myInvoices: [Invoice!]!
        myInvoice(id: ID!): Invoice
    }

    extend type Mutation {
        createInvoice(input: CreateInvoiceInput!): Invoice!
        downloadInvoicePdf(id: ID!): Invoice!
    }

    type InvoiceTitle implements Node {
        id: ID!
        title: String!
        taxNumber: String
        email: String
        companyAddress: String
        companyPhone: String
        bankName: String
        bankAccount: String
        customerId: ID!
        isDefault: Boolean!
        createdAt: DateTime!
        updatedAt: DateTime!
    }

    input CreateInvoiceTitleInput {
        title: String!
        taxNumber: String
        email: String
        companyAddress: String
        companyPhone: String
        bankName: String
        bankAccount: String
        isDefault: Boolean
    }

    input UpdateInvoiceTitleInput {
        title: String
        taxNumber: String
        email: String
        companyAddress: String
        companyPhone: String
        bankName: String
        bankAccount: String
        isDefault: Boolean
    }

    extend type Query {
        myInvoiceTitles: [InvoiceTitle!]!
    }

    extend type Mutation {
        createInvoiceTitle(input: CreateInvoiceTitleInput!): InvoiceTitle!
        updateInvoiceTitle(id: ID!, input: UpdateInvoiceTitleInput!): InvoiceTitle!
        setDefaultInvoiceTitle(id: ID!): InvoiceTitle!
        deleteInvoiceTitle(id: ID!): Boolean!
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
        // 支持可注入的 provider（如 PdfInvoiceProvider：内部懒取 InvoicePdfService/AssetStorageStrategy/OrderService）
        const provider = this.options.provider;
        if (provider && typeof provider.init === 'function') {
            provider.init(this.injector);
        }
        // 自动开票（默认关）：订单进入可开票状态且要求发票时自动开具
        if (this.options.autoIssue) {
            const eventBus = this.injector.get(core_2.EventBus);
            const allowedStates = ['Delivered', 'Completed', 'PartialDelivery'];
            eventBus.ofType(core_2.OrderStateTransitionEvent).subscribe(async (event) => {
                if (!allowedStates.includes(event.toState))
                    return;
                try {
                    await this.invoiceService.autoIssueForOrder(event.ctx, event.order.id);
                }
                catch (e) {
                    core_2.Logger.error(`autoIssue order ${event.order.id} failed: ${e.message}`, constants_1.loggerCtx);
                }
            });
            core_2.Logger.info('autoIssue enabled', constants_1.loggerCtx);
        }
        core_2.Logger.info('InvoicePlugin initialized', constants_1.loggerCtx);
    }
};
exports.InvoicePlugin = InvoicePlugin;
InvoicePlugin.options = {};
exports.InvoicePlugin = InvoicePlugin = InvoicePlugin_1 = __decorate([
    (0, core_2.VendurePlugin)({
        imports: [core_2.PluginCommonModule],
        entities: [invoice_entity_1.Invoice, invoice_title_entity_1.InvoiceTitle],
        providers: [
            { provide: constants_1.INVOICE_PLUGIN_OPTIONS, useFactory: () => InvoicePlugin.options },
            invoice_service_1.InvoiceService,
            invoice_title_service_1.InvoiceTitleService,
        ],
        adminApiExtensions: {
            schema: adminSchema,
            resolvers: [invoice_admin_resolver_1.InvoiceAdminResolver],
        },
        shopApiExtensions: {
            schema: shopSchema,
            resolvers: [invoice_shop_resolver_1.InvoiceShopResolver, invoice_title_shop_resolver_1.InvoiceTitleShopResolver],
        },
        configuration: (config) => {
            config.customFields.Order = mergeCustomFields(config.customFields.Order, order_custom_fields_1.invoiceOrderCustomFields.Order);
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
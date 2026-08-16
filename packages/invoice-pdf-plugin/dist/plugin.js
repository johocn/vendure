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
var InvoicePdfPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvoicePdfPlugin = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const graphql_tag_1 = __importDefault(require("graphql-tag"));
const constants_1 = require("./constants");
const invoice_pdf_admin_resolver_1 = require("./invoice-pdf-admin.resolver");
const invoice_pdf_service_1 = require("./invoice-pdf.service");
const order_custom_fields_1 = require("./order-custom-fields");
/** Idempotently merge custom fields, deduplicating by field name (preBootstrapConfig may run plugin configurations multiple times). */
function mergeCustomFields(existingFields, additions) {
    const names = new Set((existingFields !== null && existingFields !== void 0 ? existingFields : []).map(f => f.name));
    return [...(existingFields !== null && existingFields !== void 0 ? existingFields : []), ...(additions !== null && additions !== void 0 ? additions : []).filter(f => !names.has(f.name))];
}
let InvoicePdfPlugin = InvoicePdfPlugin_1 = class InvoicePdfPlugin {
    constructor(options) {
        this.options = options;
    }
    static init(options) {
        InvoicePdfPlugin_1.options = options !== null && options !== void 0 ? options : {};
        return InvoicePdfPlugin_1;
    }
};
exports.InvoicePdfPlugin = InvoicePdfPlugin;
InvoicePdfPlugin.options = {};
exports.InvoicePdfPlugin = InvoicePdfPlugin = InvoicePdfPlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        providers: [
            { provide: constants_1.INVOICE_PDF_PLUGIN_OPTIONS, useFactory: () => InvoicePdfPlugin.options },
            invoice_pdf_service_1.InvoicePdfService,
        ],
        adminApiExtensions: {
            schema: () => (0, graphql_tag_1.default) `
            type InvoicePdfResult {
                url: String!
                invoiceNumber: String!
            }

            extend type Mutation {
                generateInvoicePdf(orderId: ID!): InvoicePdfResult!
            }
        `,
            resolvers: [invoice_pdf_admin_resolver_1.InvoicePdfAdminResolver],
        },
        configuration: (config) => {
            config.customFields.Order = mergeCustomFields(config.customFields.Order, order_custom_fields_1.invoicePdfOrderCustomFields.Order);
            return config;
        },
        dashboard: '../dashboard/index.tsx',
        compatibility: '^3.0.0',
    }),
    __param(0, (0, common_1.Inject)(constants_1.INVOICE_PDF_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object])
], InvoicePdfPlugin);

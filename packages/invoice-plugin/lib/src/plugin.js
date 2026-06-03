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
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const order_custom_fields_1 = require("./order-custom-fields");
let InvoicePlugin = InvoicePlugin_1 = class InvoicePlugin {
    constructor(options) {
        this.options = options;
    }
    static init(options) {
        InvoicePlugin_1.options = options !== null && options !== void 0 ? options : {};
        return InvoicePlugin_1;
    }
};
exports.InvoicePlugin = InvoicePlugin;
InvoicePlugin.options = {};
exports.InvoicePlugin = InvoicePlugin = InvoicePlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        providers: [
            { provide: constants_1.INVOICE_PLUGIN_OPTIONS, useFactory: () => InvoicePlugin.options },
        ],
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
    __metadata("design:paramtypes", [Object])
], InvoicePlugin);
//# sourceMappingURL=plugin.js.map
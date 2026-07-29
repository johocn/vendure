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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MultivendorService = void 0;
const common_1 = require("@nestjs/common");
const generated_types_1 = require("@vendure/common/lib/generated-types");
const normalize_string_1 = require("@vendure/common/lib/normalize-string");
const core_1 = require("@vendure/core");
const mv_shipping_eligibility_checker_1 = require("../config/mv-shipping-eligibility-checker");
let MultivendorService = class MultivendorService {
    constructor(administratorService, sellerService, roleService, channelService, shippingMethodService, configService, stockLocationService, requestContextService, connection) {
        this.administratorService = administratorService;
        this.sellerService = sellerService;
        this.roleService = roleService;
        this.channelService = channelService;
        this.shippingMethodService = shippingMethodService;
        this.configService = configService;
        this.stockLocationService = stockLocationService;
        this.requestContextService = requestContextService;
        this.connection = connection;
    }
    async registerNewSeller(ctx, input) {
        const superAdminCtx = await this.getSuperAdminContext(ctx);
        const channel = await this.createSellerChannelRoleAdmin(superAdminCtx, input);
        await this.createSellerShippingMethod(superAdminCtx, input.shopName, channel);
        await this.createSellerStockLocation(superAdminCtx, input.shopName, channel);
        return channel;
    }
    async createSellerShippingMethod(ctx, shopName, sellerChannel) {
        const defaultChannel = await this.channelService.getDefaultChannel(ctx);
        const { shippingEligibilityCheckers, shippingCalculators, fulfillmentHandlers } = this.configService.shippingOptions;
        const shopCode = (0, normalize_string_1.normalizeString)(shopName, '-');
        const checker = shippingEligibilityCheckers.find(c => c.code === mv_shipping_eligibility_checker_1.multivendorShippingEligibilityChecker.code);
        const calculator = shippingCalculators.find(c => c.code === core_1.defaultShippingCalculator.code);
        const fulfillmentHandler = fulfillmentHandlers.find(h => h.code === core_1.manualFulfillmentHandler.code);
        if (!checker) {
            throw new core_1.InternalServerError('Could not find a suitable ShippingEligibilityChecker for the seller');
        }
        if (!calculator) {
            throw new core_1.InternalServerError('Could not find a suitable ShippingCalculator for the seller');
        }
        if (!fulfillmentHandler) {
            throw new core_1.InternalServerError('Could not find a suitable FulfillmentHandler for the seller');
        }
        const shippingMethod = await this.shippingMethodService.create(ctx, {
            code: `${shopCode}-shipping`,
            checker: {
                code: checker.code,
                arguments: [],
            },
            calculator: {
                code: calculator.code,
                arguments: [
                    { name: 'rate', value: '500' },
                    { name: 'includesTax', value: core_1.TaxSetting.auto },
                    { name: 'taxRate', value: '20' },
                ],
            },
            fulfillmentHandler: fulfillmentHandler.code,
            translations: [
                {
                    languageCode: defaultChannel.defaultLanguageCode,
                    name: `Standard Shipping for ${shopName}`,
                },
            ],
        });
        await this.channelService.assignToChannels(ctx, core_1.ShippingMethod, shippingMethod.id, [
            sellerChannel.id,
        ]);
    }
    async createSellerStockLocation(ctx, shopName, sellerChannel) {
        const stockLocation = await this.stockLocationService.create(ctx, {
            name: `${shopName} Warehouse`,
        });
        await this.channelService.assignToChannels(ctx, core_1.StockLocation, stockLocation.id, [sellerChannel.id]);
    }
    async createSellerChannelRoleAdmin(ctx, input) {
        const defaultChannel = await this.channelService.getDefaultChannel(ctx);
        const shopCode = (0, normalize_string_1.normalizeString)(input.shopName, '-');
        const seller = await this.sellerService.create(ctx, {
            name: input.shopName,
            customFields: {
                // This simulates a connection to a payment provider,
                // which would supply the connected account ID.
                // In this case we just use a pseudo-random string
                connectedAccountId: Math.random().toString(30).substring(3),
            },
        });
        const channel = await this.channelService.create(ctx, {
            code: shopCode,
            sellerId: seller.id,
            token: `${shopCode}-token`,
            currencyCode: defaultChannel.defaultCurrencyCode,
            defaultLanguageCode: defaultChannel.defaultLanguageCode,
            pricesIncludeTax: defaultChannel.pricesIncludeTax,
            defaultShippingZoneId: defaultChannel.defaultShippingZone.id,
            defaultTaxZoneId: defaultChannel.defaultTaxZone.id,
        });
        if ((0, core_1.isGraphQlErrorResult)(channel)) {
            throw new core_1.InternalServerError(channel.message);
        }
        const superAdminRole = await this.roleService.getSuperAdminRole(ctx);
        const customerRole = await this.roleService.getCustomerRole(ctx);
        await this.roleService.assignRoleToChannel(ctx, superAdminRole.id, channel.id);
        const role = await this.roleService.create(ctx, {
            code: `${shopCode}-admin`,
            channelIds: [channel.id],
            description: `Administrator of ${input.shopName}`,
            permissions: [
                generated_types_1.Permission.CreateCatalog,
                generated_types_1.Permission.UpdateCatalog,
                generated_types_1.Permission.ReadCatalog,
                generated_types_1.Permission.DeleteCatalog,
                generated_types_1.Permission.CreateOrder,
                generated_types_1.Permission.ReadOrder,
                generated_types_1.Permission.UpdateOrder,
                generated_types_1.Permission.DeleteOrder,
                generated_types_1.Permission.ReadCustomer,
                generated_types_1.Permission.ReadPaymentMethod,
                generated_types_1.Permission.ReadShippingMethod,
                generated_types_1.Permission.ReadPromotion,
                generated_types_1.Permission.ReadCountry,
                generated_types_1.Permission.ReadZone,
                generated_types_1.Permission.CreateCustomer,
                generated_types_1.Permission.UpdateCustomer,
                generated_types_1.Permission.DeleteCustomer,
                generated_types_1.Permission.CreateTag,
                generated_types_1.Permission.ReadTag,
                generated_types_1.Permission.UpdateTag,
                generated_types_1.Permission.DeleteTag,
            ],
        });
        const administrator = await this.administratorService.create(ctx, {
            firstName: input.seller.firstName,
            lastName: input.seller.lastName,
            emailAddress: input.seller.emailAddress,
            password: input.seller.password,
            roleIds: [role.id],
        });
        return channel;
    }
    async getSuperAdminContext(ctx) {
        const { superadminCredentials } = this.configService.authOptions;
        const superAdminUser = await this.connection.getRepository(ctx, core_1.User).findOne({
            where: {
                identifier: superadminCredentials.identifier,
            },
        });
        return this.requestContextService.create({
            apiType: 'shop',
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            user: superAdminUser,
        });
    }
};
exports.MultivendorService = MultivendorService;
exports.MultivendorService = MultivendorService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.AdministratorService,
        core_1.SellerService,
        core_1.RoleService,
        core_1.ChannelService,
        core_1.ShippingMethodService,
        core_1.ConfigService,
        core_1.StockLocationService,
        core_1.RequestContextService,
        core_1.TransactionalConnection])
], MultivendorService);
//# sourceMappingURL=mv.service.js.map
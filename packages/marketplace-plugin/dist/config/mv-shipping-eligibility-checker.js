"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.multivendorShippingEligibilityChecker = void 0;
const generated_types_1 = require("@vendure/common/lib/generated-types");
const shared_constants_1 = require("@vendure/common/lib/shared-constants");
const core_1 = require("@vendure/core");
let entityHydrator;
/**
 * @description
 * Shipping method is eligible if at least one OrderLine is associated with the Seller's Channel.
 */
exports.multivendorShippingEligibilityChecker = new core_1.ShippingEligibilityChecker({
    code: 'multivendor-shipping-eligibility-checker',
    description: [{ languageCode: generated_types_1.LanguageCode.en, value: 'Multivendor Shipping Eligibility Checker' }],
    args: {},
    init(injector) {
        entityHydrator = injector.get(core_1.EntityHydrator);
    },
    check: async (ctx, order, args, method) => {
        await entityHydrator.hydrate(ctx, method, { relations: ['channels'] });
        await entityHydrator.hydrate(ctx, order, { relations: ['lines.sellerChannel'] });
        const sellerChannel = method.channels.find(c => c.code !== shared_constants_1.DEFAULT_CHANNEL_CODE);
        if (!sellerChannel) {
            return false;
        }
        for (const line of order.lines) {
            if (line.sellerChannelId && (0, core_1.idsAreEqual)(line.sellerChannelId, sellerChannel.id)) {
                return true;
            }
        }
        return false;
    },
});

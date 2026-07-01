"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultEmailHandlers = exports.emailAddressChangeHandler = exports.passwordResetHandler = exports.emailVerificationHandler = exports.orderConfirmationHandler = void 0;
exports.transformOrderLineAssetUrls = transformOrderLineAssetUrls;
exports.shippingLinesWithMethod = shippingLinesWithMethod;
/* eslint-disable @typescript-eslint/no-non-null-assertion */
const core_1 = require("@vendure/core");
const event_listener_1 = require("../event-listener");
const mock_events_1 = require("./mock-events");
exports.orderConfirmationHandler = new event_listener_1.EmailEventListener('order-confirmation')
    .on(core_1.OrderStateTransitionEvent)
    .filter(event => event.toState === 'PaymentSettled' && event.fromState !== 'Modifying' && !!event.order.customer)
    .loadData(async ({ event, injector }) => {
    const entityHydrator = injector.get(core_1.EntityHydrator);
    await entityHydrator.hydrate(event.ctx, event.order, {
        relations: ['lines.featuredAsset', 'shippingLines.shippingMethod'],
    });
    transformOrderLineAssetUrls(event.ctx, event.order, injector);
    const shippingLines = shippingLinesWithMethod(event.order);
    return { shippingLines };
})
    .setRecipient(event => event.order.customer.emailAddress)
    .setFrom('{{ fromAddress }}')
    .setSubject('Order confirmation for #{{ order.code }}')
    .setTemplateVars(event => ({ order: event.order, shippingLines: event.data.shippingLines }))
    .setMockEvent(mock_events_1.mockOrderStateTransitionEvent);
exports.emailVerificationHandler = new event_listener_1.EmailEventListener('email-verification')
    .on(core_1.AccountRegistrationEvent)
    .filter(event => !!event.user.getNativeAuthenticationMethod().identifier)
    .filter(event => {
    const nativeAuthMethod = event.user.authenticationMethods.find(m => m instanceof core_1.NativeAuthenticationMethod);
    return (nativeAuthMethod && !!nativeAuthMethod.identifier) || false;
})
    .setRecipient(event => event.user.identifier)
    .setFrom('{{ fromAddress }}')
    .setSubject('Please verify your email address')
    .setTemplateVars(event => ({
    verificationToken: event.user.getNativeAuthenticationMethod().verificationToken,
}))
    .setMockEvent(mock_events_1.mockAccountRegistrationEvent);
exports.passwordResetHandler = new event_listener_1.EmailEventListener('password-reset')
    .on(core_1.PasswordResetEvent)
    .setRecipient(event => event.user.identifier)
    .setFrom('{{ fromAddress }}')
    .setSubject('Forgotten password reset')
    .setTemplateVars(event => ({
    passwordResetToken: event.user.getNativeAuthenticationMethod().passwordResetToken,
}))
    .setMockEvent(mock_events_1.mockPasswordResetEvent);
exports.emailAddressChangeHandler = new event_listener_1.EmailEventListener('email-address-change')
    .on(core_1.IdentifierChangeRequestEvent)
    .setRecipient(event => event.user.getNativeAuthenticationMethod().pendingIdentifier)
    .setFrom('{{ fromAddress }}')
    .setSubject('Please verify your change of email address')
    .setTemplateVars(event => ({
    identifierChangeToken: event.user.getNativeAuthenticationMethod().identifierChangeToken,
}))
    .setMockEvent(mock_events_1.mockEmailAddressChangeEvent);
exports.defaultEmailHandlers = [
    exports.orderConfirmationHandler,
    exports.emailVerificationHandler,
    exports.passwordResetHandler,
    exports.emailAddressChangeHandler,
];
/**
 * @description
 * Applies the configured `AssetStorageStrategy.toAbsoluteUrl()` function to each of the
 * OrderLine's `featuredAsset.preview` properties, so that they can be correctly displayed
 * in the email template.
 * This is required since that step usually happens at the API in middleware, which is not
 * applicable in this context. So we need to do it manually.
 *
 * **Note: Mutates the Order object**
 *
 * @docsCategory core plugins/EmailPlugin
 * @docsPage Email utils
 */
function transformOrderLineAssetUrls(ctx, order, injector) {
    const { assetStorageStrategy } = injector.get(core_1.ConfigService).assetOptions;
    if (assetStorageStrategy.toAbsoluteUrl) {
        const toAbsoluteUrl = assetStorageStrategy.toAbsoluteUrl.bind(assetStorageStrategy);
        for (const line of order.lines) {
            if (line.featuredAsset) {
                line.featuredAsset.preview = toAbsoluteUrl(ctx.req, line.featuredAsset.preview);
            }
        }
    }
    return order;
}
/**
 * @description
 * Ensures that the ShippingLines have a shippingMethod so that we can use the
 * `shippingMethod.name` property in the email template.
 *
 * @docsCategory core plugins/EmailPlugin
 * @docsPage Email utils
 */
function shippingLinesWithMethod(order) {
    const shippingLines = [];
    for (const line of order.shippingLines || []) {
        if (line.shippingMethod) {
            shippingLines.push(line);
        }
    }
    return shippingLines;
}
//# sourceMappingURL=default-email-handlers.js.map
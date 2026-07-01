import { AccountRegistrationEvent, IdentifierChangeRequestEvent, Injector, Order, OrderStateTransitionEvent, PasswordResetEvent, RequestContext, ShippingLine } from '@vendure/core';
import { EmailEventHandler } from './event-handler';
export declare const orderConfirmationHandler: EmailEventHandler<"order-confirmation", import("../types").EventWithAsyncData<OrderStateTransitionEvent, {
    shippingLines: ShippingLine[];
}>>;
export declare const emailVerificationHandler: EmailEventHandler<"email-verification", AccountRegistrationEvent>;
export declare const passwordResetHandler: EmailEventHandler<"password-reset", PasswordResetEvent>;
export declare const emailAddressChangeHandler: EmailEventHandler<"email-address-change", IdentifierChangeRequestEvent>;
export declare const defaultEmailHandlers: Array<EmailEventHandler<any, any>>;
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
export declare function transformOrderLineAssetUrls(ctx: RequestContext, order: Order, injector: Injector): Order;
/**
 * @description
 * Ensures that the ShippingLines have a shippingMethod so that we can use the
 * `shippingMethod.name` property in the email template.
 *
 * @docsCategory core plugins/EmailPlugin
 * @docsPage Email utils
 */
export declare function shippingLinesWithMethod(order: Order): ShippingLine[];

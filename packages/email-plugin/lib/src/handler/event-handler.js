"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailEventHandlerWithAsyncData = exports.EmailEventHandler = void 0;
const core_1 = require("@vendure/core");
const attachment_utils_1 = require("../attachment-utils");
const constants_1 = require("../constants");
/**
 * @description
 * The EmailEventHandler defines how the EmailPlugin will respond to a given event.
 *
 * A handler is created by creating a new {@link EmailEventListener} and calling the `.on()` method
 * to specify which event to respond to.
 *
 * @example
 * ```ts
 * const confirmationHandler = new EmailEventListener('order-confirmation')
 *   .on(OrderStateTransitionEvent)
 *   .filter(event => event.toState === 'PaymentSettled')
 *   .setRecipient(event => event.order.customer.emailAddress)
 *   .setFrom('{{ fromAddress }}')
 *   .setSubject(`Order confirmation for #{{ order.code }}`)
 *   .setTemplateVars(event => ({ order: event.order }));
 * ```
 *
 * This example creates a handler which listens for the `OrderStateTransitionEvent` and if the Order has
 * transitioned to the `'PaymentSettled'` state, it will generate and send an email.
 *
 * The string argument passed into the `EmailEventListener` constructor is used to identify the handler, and
 * also to locate the directory of the email template files. So in the example above, there should be a directory
 * `<app root>/static/email/templates/order-confirmation` which contains a Handlebars template named `body.hbs`.
 *
 * ## Handling other languages
 *
 * By default, the handler will respond to all events on all channels and use the same subject ("Order confirmation for #12345" above)
 * and body template.
 *
 * Since v2.0 the `.addTemplate()` method has been **deprecated**. To serve different templates — for example, based on the current
 * `languageCode` — implement a custom {@link TemplateLoader} and pass it to `EmailPlugin.init({ templateLoader: new MyTemplateLoader() })`.
 *
 * The language is typically determined by the `languageCode` property of the event's `ctx` ({@link RequestContext}) object, so the
 * `loadTemplate()` method can use that to locate the correct template file.
 *
 * @example
 * ```ts
 * import { EmailPlugin, TemplateLoader } from '\@vendure/email-plugin';
 * import { readFileSync } from 'fs';
 * import path from 'path';
 *
 * class CustomLanguageAwareTemplateLoader implements TemplateLoader {
 *   constructor(private templateDir: string) {}
 *
 *   async loadTemplate(_injector, ctx, { type, templateName }) {
 *     // e.g. returns the content of "body.de.hbs" or "body.en.hbs" depending on ctx.languageCode
 *     const filePath = path.join(this.templateDir, type, `${templateName}.${ctx.languageCode}.hbs`);
 *     return readFileSync(filePath, 'utf-8');
 *   }
 * }
 *
 * EmailPlugin.init({
 *   templateLoader: new CustomLanguageAwareTemplateLoader(path.join(__dirname, '../static/email/templates')),
 *   handlers: defaultEmailHandlers,
 * });
 * ```
 *
 * ## Defining a custom handler
 *
 * Let's say you have a plugin which defines a new event type, `QuoteRequestedEvent`. In your plugin you have defined a mutation
 * which is executed when the customer requests a quote in your storefront, and in your resolver, you use the {@link EventBus} to publish a
 * new `QuoteRequestedEvent`.
 *
 * You now want to email the customer with their quote. Here are the steps you would take to set this up:
 *
 * ### 1. Create a new handler
 *
 * ```ts
 * import { EmailEventListener } from `\@vendure/email-plugin`;
 * import { QuoteRequestedEvent } from `./events`;
 *
 * const quoteRequestedHandler = new EmailEventListener('quote-requested')
 *   .on(QuoteRequestedEvent)
 *   .setRecipient(event => event.customer.emailAddress)
 *   .setSubject(`Here's the quote you requested`)
 *   .setFrom('{{ fromAddress }}')
 *   .setTemplateVars(event => ({ details: event.details }));
 * ```
 *
 * ### 2. Create the email template
 *
 * Next you need to make sure there is a template defined at `<app root>/static/email/templates/quote-requested/body.hbs`. The path
 * segment `quote-requested` must match the string passed to the `EmailEventListener` constructor.
 *
 * The template would look something like this:
 *
 * ```handlebars
 * {{> header title="Here's the quote you requested" }}
 *
 * <mj-section background-color="#fafafa">
 *     <mj-column>
 *         <mj-text color="#525252">
 *             Thank you for your interest in our products! Here's the details
 *             of the quote you recently requested:
 *         </mj-text>
 *
 *         <!-- your custom email layout goes here -->
 *     </mj-column>
 * </mj-section>
 *
 *
 * {{> footer }}
 * ```
 *
 * You can find pre-made templates on the [MJML website](https://mjml.io/templates/).
 *
 * ### 3. Register the handler
 *
 * Finally, you need to register the handler with the EmailPlugin:
 *
 * ```ts {hl_lines=[8]}
 * import { defaultEmailHandlers, EmailPlugin } from '\@vendure/email-plugin';
 * import { quoteRequestedHandler } from './plugins/quote-plugin';
 *
 * const config: VendureConfig = {
 *   // Add an instance of the plugin to the plugins array
 *   plugins: [
 *     EmailPlugin.init({
 *       handler: [...defaultEmailHandlers, quoteRequestedHandler],
 *       // ... etc
 *     }),
 *   ],
 * };
 * ```
 *
 * @docsCategory core plugins/EmailPlugin
 */
class EmailEventHandler {
    constructor(listener, event) {
        this.listener = listener;
        this.event = event;
        this.filterFns = [];
        this.configurations = [];
    }
    /** @internal */
    get type() {
        return this.listener.type;
    }
    /** @internal */
    get mockEvent() {
        return this._mockEvent;
    }
    /**
     * @description
     * Defines a predicate function which is used to determine whether the event will trigger an email.
     * Multiple filter functions may be defined.
     */
    filter(filterFn) {
        this.filterFns.push(filterFn);
        return this;
    }
    /**
     * @description
     * A function which defines how the recipient email address should be extracted from the incoming event.
     *
     * The recipient can be a plain email address: `'foobar@example.com'`
     * Or with a formatted name (includes unicode support): `'Ноде Майлер <foobar@example.com>'`
     * Or a comma-separated list of addresses: `'foobar@example.com, "Ноде Майлер" <bar@example.com>'`
     */
    setRecipient(setRecipientFn) {
        this.setRecipientFn = setRecipientFn;
        return this;
    }
    /**
     * @description
     * A function which allows to override the language of the email. If not defined, the language from the context will be used.
     *
     * @since 1.8.0
     */
    setLanguageCode(setLanguageCodeFn) {
        this.setLanguageCodeFn = setLanguageCodeFn;
        return this;
    }
    /**
     * @description
     * A function which returns an object hash of variables which will be made available to the Handlebars template
     * and subject line for interpolation.
     */
    setTemplateVars(templateVarsFn) {
        this.setTemplateVarsFn = templateVarsFn;
        return this;
    }
    /**
     * @description
     * Sets the default subject of the email. The subject string may use Handlebars variables defined by the
     * setTemplateVars() method.
     */
    setSubject(defaultSubject) {
        if (typeof defaultSubject === 'string') {
            this.defaultSubject = defaultSubject;
        }
        else {
            this.setSubjectFn = defaultSubject;
        }
        return this;
    }
    /**
     * @description
     * Sets the default from field of the email. The from string may use Handlebars variables defined by the
     * setTemplateVars() method.
     */
    setFrom(from) {
        this.from = from;
        return this;
    }
    /**
     * @description
     * A function which allows {@link OptionalAddressFields} to be specified such as "cc" and "bcc".
     *
     * @since 1.1.0
     */
    setOptionalAddressFields(optionalAddressFieldsFn) {
        this.setOptionalAddressFieldsFn = optionalAddressFieldsFn;
        return this;
    }
    /**
     * @description
     * A function which allows {@link EmailMetadata} to be specified for the email. This can be used
     * to store arbitrary data about the email which can be used for tracking or other purposes.
     *
     * It will be exposed in the {@link EmailSendEvent} as `event.metadata`. Here's an example of usage:
     *
     * - An {@link OrderStateTransitionEvent} occurs, and the EmailEventListener starts processing it.
     * - The EmailEventHandler attaches metadata to the email:
     *    ```ts
     *    new EmailEventListener(EventType.ORDER_CONFIRMATION)
     *      .on(OrderStateTransitionEvent)
     *      .setMetadata(event => ({
     *        type: EventType.ORDER_CONFIRMATION,
     *        orderId: event.order.id,
     *      }));
     *   ```
     * - Then, the EmailPlugin tries to send the email and publishes {@link EmailSendEvent},
     *   passing ctx, emailDetails, error or success, and this metadata.
     * - In another part of the server, we have an eventBus that subscribes to EmailSendEvent. We can use
     *   `metadata.type` and `metadata.orderId` to identify the related order. For example, we can indicate on the
     *    order that the email was successfully sent, or in case of an error, send a notification confirming
     *    the order in another available way.
     *
     * @since 3.1.0
     */
    setMetadata(optionalSetMetadataFn) {
        this.setMetadataFn = optionalSetMetadataFn;
        return this;
    }
    /**
     * @description
     * Defines one or more files to be attached to the email. An attachment can be specified
     * as either a `path` (to a file or URL) or as `content` which can be a string, Buffer or Stream.
     *
     * **Note:** When using the `content` to pass a Buffer or Stream, the raw data will get serialized
     * into the job queue. For this reason the total size of all attachments passed as `content` should kept to
     * **less than ~50k**. If the attachments are greater than that limit, a warning will be logged and
     * errors may result if using the DefaultJobQueuePlugin with certain DBs such as MySQL/MariaDB.
     *
     * @example
     * ```ts
     * const testAttachmentHandler = new EmailEventListener('activate-voucher')
     *   .on(ActivateVoucherEvent)
     *   // ... omitted some steps for brevity
     *   .setAttachments(async (event) => {
     *     const { imageUrl, voucherCode } = await getVoucherDataForUser(event.user.id);
     *     return [
     *       {
     *         filename: `voucher-${voucherCode}.jpg`,
     *         path: imageUrl,
     *       },
     *     ];
     *   });
     * ```
     */
    setAttachments(setAttachmentsFn) {
        this.setAttachmentsFn = setAttachmentsFn;
        return this;
    }
    /**
     * @description
     * Add configuration for another template other than the default `"body.hbs"`. Use this method to define specific
     * templates for channels or languageCodes other than the default.
     *
     * @deprecated Define a custom TemplateLoader on plugin initalization to define templates based on the RequestContext.
     * E.g. `EmailPlugin.init({ templateLoader: new CustomTemplateLoader() })`
     */
    addTemplate(config) {
        this.configurations.push(config);
        return this;
    }
    /**
     * @description
     * Allows data to be loaded asynchronously which can then be used as template variables.
     * The `loadDataFn` has access to the event, the TypeORM `Connection` object, and an
     * `inject()` function which can be used to inject any of the providers exported
     * by the {@link PluginCommonModule}. The return value of the `loadDataFn` will be
     * added to the `event` as the `data` property.
     *
     * @example
     * ```ts
     * new EmailEventListener('order-confirmation')
     *   .on(OrderStateTransitionEvent)
     *   .filter(event => event.toState === 'PaymentSettled' && !!event.order.customer)
     *   .loadData(({ event, injector }) => {
     *     const orderService = injector.get(OrderService);
     *     return orderService.getOrderPayments(event.order.id);
     *   })
     *   .setTemplateVars(event => ({
     *     order: event.order,
     *     payments: event.data,
     *   }))
     *   // ...
     * ```
     */
    loadData(loadDataFn) {
        const asyncHandler = new EmailEventHandlerWithAsyncData(loadDataFn, this.listener, this.event);
        asyncHandler.setRecipientFn = this.setRecipientFn;
        asyncHandler.setTemplateVarsFn = this.setTemplateVarsFn;
        asyncHandler.setAttachmentsFn = this.setAttachmentsFn;
        asyncHandler.setOptionalAddressFieldsFn = this.setOptionalAddressFieldsFn;
        asyncHandler.setMetadataFn = this.setMetadataFn;
        asyncHandler.filterFns = this.filterFns;
        asyncHandler.configurations = this.configurations;
        asyncHandler.defaultSubject = this.defaultSubject;
        asyncHandler.from = this.from;
        asyncHandler._mockEvent = this._mockEvent;
        return asyncHandler;
    }
    /**
     * @description
     * Used internally by the EmailPlugin to handle incoming events.
     *
     * @internal
     */
    async handle(event, globals = {}, injector) {
        var _a, _b, _c, _d, _e;
        for (const filterFn of this.filterFns) {
            if (!filterFn(event)) {
                return;
            }
        }
        if (this instanceof EmailEventHandlerWithAsyncData) {
            try {
                event.data = await this._loadDataFn({
                    event,
                    injector,
                });
            }
            catch (err) {
                if (err instanceof Error) {
                    core_1.Logger.error(err.message, constants_1.loggerCtx, err.stack);
                }
                else {
                    core_1.Logger.error(String(err), constants_1.loggerCtx);
                }
                return;
            }
        }
        if (!this.setRecipientFn) {
            throw new Error(`No setRecipientFn has been defined. ` +
                `Remember to call ".setRecipient()" when setting up the EmailEventHandler for ${this.type}`);
        }
        if (this.from === undefined) {
            throw new Error(`No from field has been defined. ` +
                `Remember to call ".setFrom()" when setting up the EmailEventHandler for ${this.type}`);
        }
        const { ctx } = event;
        const languageCode = ((_a = this.setLanguageCodeFn) === null || _a === void 0 ? void 0 : _a.call(this, event)) || ctx.languageCode;
        const configuration = this.getBestConfiguration(ctx.channel.code, languageCode);
        const subject = configuration
            ? configuration.subject
            : this.setSubjectFn
                ? await this.setSubjectFn(event, ctx, injector)
                : this.defaultSubject;
        if (subject == null) {
            throw new Error(`No subject field has been defined. ` +
                `Remember to call ".setSubject()" when setting up the EmailEventHandler for ${this.type}`);
        }
        const recipient = this.setRecipientFn(event);
        const templateVars = this.setTemplateVarsFn ? this.setTemplateVarsFn(event, globals) : {};
        let attachmentsArray = [];
        try {
            attachmentsArray = (_c = (await ((_b = this.setAttachmentsFn) === null || _b === void 0 ? void 0 : _b.call(this, event)))) !== null && _c !== void 0 ? _c : [];
        }
        catch (e) {
            core_1.Logger.error(e, constants_1.loggerCtx, e.stack);
        }
        const attachments = await (0, attachment_utils_1.serializeAttachments)(attachmentsArray);
        const optionalAddressFields = (_e = (await ((_d = this.setOptionalAddressFieldsFn) === null || _d === void 0 ? void 0 : _d.call(this, event)))) !== null && _e !== void 0 ? _e : {};
        const metadata = this.setMetadataFn ? await this.setMetadataFn(event) : {};
        return Object.assign({ ctx: event.ctx.serialize(), type: this.type, recipient, from: this.from, templateVars: Object.assign(Object.assign({}, globals), templateVars), subject, templateFile: configuration ? configuration.templateFile : 'body.hbs', attachments,
            metadata }, optionalAddressFields);
    }
    /**
     * @description
     * Optionally define a mock Event which is used by the dev mode mailbox app for generating mock emails
     * from this handler, which is useful when developing the email templates.
     */
    setMockEvent(event) {
        this._mockEvent = event;
        return this;
    }
    getBestConfiguration(channelCode, languageCode) {
        if (this.configurations.length === 0) {
            return;
        }
        const exactMatch = this.configurations.find(c => {
            return ((c.channelCode === channelCode || c.channelCode === 'default') &&
                c.languageCode === languageCode);
        });
        if (exactMatch) {
            return exactMatch;
        }
        const channelMatch = this.configurations.find(c => c.channelCode === channelCode && c.languageCode === 'default');
        if (channelMatch) {
            return channelMatch;
        }
        return;
    }
}
exports.EmailEventHandler = EmailEventHandler;
/**
 * @description
 * Identical to the {@link EmailEventHandler} but with a `data` property added to the `event` based on the result
 * of the `.loadData()` function.
 *
 * @docsCategory core plugins/EmailPlugin
 */
class EmailEventHandlerWithAsyncData extends EmailEventHandler {
    constructor(_loadDataFn, listener, event) {
        super(listener, event);
        this._loadDataFn = _loadDataFn;
    }
}
exports.EmailEventHandlerWithAsyncData = EmailEventHandlerWithAsyncData;
//# sourceMappingURL=event-handler.js.map